import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createLiveSubscription,
  createInventoryRefresh,
  createInventorySubscription,
  mergeInventory,
  mergeStockBoxes,
  snapshotResetsScene,
} from '../src/live/stream.js'

class Source {
  static instances = []
  listeners = {}
  constructor(url, options) {
    this.url = url
    this.options = options
    Source.instances.push(this)
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn
  }
  emit(name, data) {
    this.listeners[name]?.({ data: JSON.stringify(data) })
  }
  close() {
    this.closed = true
  }
}

test('one subscription preserves server allocation, deduplicates and ignores events after pause', () => {
  const received = []
  const stream = createLiveSubscription('/warehouse/live', (name, data) => received.push([name, data]), {
    EventSourceImpl: Source,
  })
  stream.start()
  stream.start()
  assert.equal(Source.instances.length, 1)
  const source = Source.instances[0]
  assert.equal(source.options.withCredentials, true)
  source.emit('snapshot', { boxes: [{ id: 'B', onHandQty: 2 }] })
  source.emit('waiting', { eventId: 'one', status: 'WAITING' })
  source.emit('packed', { eventId: 'one', box: { id: 'B', onHandQty: 1 } })
  source.emit('packed', { eventId: 'one', box: { id: 'B', onHandQty: 1 } })
  assert.equal(received.length, 3)
  assert.equal(received.at(-1)[1].box.id, 'B')
  assert.equal(received.at(-1)[1].box.onHandQty, 1)
  stream.stop()
  source.emit('packed', { eventId: 'late' })
  assert.equal(received.length, 3)
  assert.equal(source.closed, true)
  stream.start()
  assert.equal(Source.instances.length, 2)
  stream.stop()
})

test('inventory merging leaves forecasts and costs unchanged', () => {
  const old = { inventory: 10, stockBySize: ['old'], demandForecast: { id: 'forecast' }, currentMonthCost: 42 }
  const next = mergeInventory(old, {
    inventory: 9,
    stockBySize: ['new'],
    demandForecast: { id: 'other' },
    currentMonthCost: 99,
  })
  assert.equal(next.inventory, 9)
  assert.deepEqual(next.stockBySize, ['new'])
  assert.equal(next.demandForecast, old.demandForecast)
  assert.equal(next.currentMonthCost, 42)
})

test('a stock update that arrives before the first dashboard load does not create a partial dashboard', () => {
  assert.equal(mergeInventory(null, { inventory: 9, stockBySize: ['new'] }), null)
})

test('only connection and live-reset snapshots clear the live scene; receipts update stock in place', () => {
  const boxes = [{ id: 'a' }, { id: 'b' }]
  assert.equal(snapshotResetsScene(boxes, { reason: 'connect', boxes }), true)
  assert.equal(snapshotResetsScene(boxes, { reason: 'reset', boxes }), true)
  assert.equal(snapshotResetsScene(boxes, { reason: 'stock', boxes: [{ id: 'b' }, { id: 'a' }] }), false)
  // 박스가 추가·비활성화되면 진열대 구성이 달라지므로 다시 그린다.
  assert.equal(snapshotResetsScene(boxes, { reason: 'stock', boxes: [{ id: 'a' }] }), true)
  // 사유가 없는 이전 서버의 snapshot은 종전처럼 장면을 다시 그린다.
  assert.equal(snapshotResetsScene(boxes, { boxes }), true)
})

test('a delayed packed event cannot overwrite newer stock from a reset or receipt', () => {
  const newer = [{ id: 'A', onHandQty: 50, version: 5 }]
  assert.deepEqual(mergeStockBoxes(newer, [{ id: 'A', onHandQty: 2, version: 4 }]), newer)
  assert.equal(mergeStockBoxes(newer, [{ id: 'A', onHandQty: 49, version: 6 }])[0].onHandQty, 49)
})

test('a CLOSED connection retries after ten seconds and pause cancels the pending retry', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const before = Source.instances.length
  const stream = createLiveSubscription('/live', () => {}, { EventSourceImpl: Source })
  stream.start()
  const failed = Source.instances.at(-1)
  failed.readyState = 2
  failed.onerror()
  t.mock.timers.tick(9999)
  assert.equal(Source.instances.length, before + 1)
  t.mock.timers.tick(1)
  assert.equal(Source.instances.length, before + 2)
  const retry = Source.instances.at(-1)
  retry.readyState = 2
  retry.onerror()
  stream.stop()
  t.mock.timers.tick(10000)
  assert.equal(Source.instances.length, before + 2)
  assert.equal(failed.closed, true)
})

test('inventory events coalesce within half a second and failures retain the last value', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  let calls = 0
  let value = 100
  let failure = ''
  const refresh = createInventoryRefresh(
    async () => {
      calls++
      if (calls === 2) throw new Error('offline')
      return 99
    },
    (next) => {
      value = next
    },
    (error) => {
      failure = error.message
    },
  )
  refresh.request()
  refresh.request()
  t.mock.timers.tick(0)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(calls, 1)
  assert.equal(value, 99)
  refresh.request()
  refresh.request()
  t.mock.timers.tick(499)
  assert.equal(calls, 1)
  t.mock.timers.tick(1)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(calls, 2)
  assert.equal(value, 99)
  assert.equal(failure, 'offline')
  refresh.stop()
  refresh.request()
  t.mock.timers.tick(3000)
  assert.equal(calls, 2)
})

test('slow inventory requests never overlap and coalesce pending events into one latest fetch', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  let calls = 0
  let finish
  const values = []
  const refresh = createInventoryRefresh(
    () => {
      calls++
      return calls === 1 ? new Promise((resolve) => (finish = resolve)) : Promise.resolve(98)
    },
    (next) => values.push(next),
    (error) => assert.fail(error),
  )
  refresh.request()
  t.mock.timers.tick(0)
  refresh.request()
  refresh.request()
  t.mock.timers.tick(1500)
  assert.equal(calls, 1, 'events must not start another request while the first is running')
  finish(99)
  await new Promise((resolve) => queueMicrotask(resolve))
  t.mock.timers.tick(0)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(calls, 2)
  assert.deepEqual(values, [99, 98])
  t.mock.timers.tick(1000)
  assert.equal(calls, 2, 'the coalesced events must not leave extra requests queued')
  refresh.stop()
})

test('waiting and failed events do not fetch inventory; packed events refresh at most twice a second', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  let calls = 0
  const updates = createInventorySubscription(
    '/live',
    async () => ++calls,
    () => {},
    (error) => assert.fail(error),
    { EventSourceImpl: Source },
  )
  const source = Source.instances.at(-1)
  source.emit('waiting', { eventId: 'waiting' })
  source.emit('failed', { eventId: 'failed' })
  t.mock.timers.tick(1000)
  assert.equal(calls, 0)
  source.emit('snapshot', { boxes: [] })
  t.mock.timers.tick(0)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(calls, 1)
  source.emit('packed', { eventId: 'first' })
  source.emit('packed', { eventId: 'second' })
  t.mock.timers.tick(499)
  assert.equal(calls, 1)
  t.mock.timers.tick(1)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(calls, 2)
  updates.stop()
})

test('leaving aborts an in-flight inventory request and ignores its late response', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  let signal
  let finish
  const values = []
  const refresh = createInventoryRefresh(
    (requestSignal) => {
      signal = requestSignal
      return new Promise((resolve) => (finish = resolve))
    },
    (next) => values.push(next),
    (error) => assert.fail(error),
  )
  refresh.request()
  t.mock.timers.tick(0)
  refresh.request()
  refresh.stop()
  assert.equal(signal.aborted, true)
  finish(99)
  await new Promise((resolve) => queueMicrotask(resolve))
  t.mock.timers.tick(1000)
  assert.deepEqual(values, [])
})

test('inventory subscribes automatically and leaving cancels both the stream and queued updates', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 })
  let value = 100
  let calls = 0
  const updates = createInventorySubscription(
    '/live',
    async () => {
      calls++
      return 99
    },
    (next) => {
      value = next
    },
    () => {},
    { EventSourceImpl: Source },
  )
  const source = Source.instances.at(-1)
  source.emit('snapshot', { boxes: [] })
  t.mock.timers.tick(0)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(value, 99, 'no play/start action is required')
  source.emit('packed', { eventId: 'new-stock' })
  updates.stop()
  t.mock.timers.tick(2000)
  await new Promise((resolve) => queueMicrotask(resolve))
  assert.equal(calls, 1)
  assert.equal(source.closed, true)
  assert.equal(value, 99)
})
