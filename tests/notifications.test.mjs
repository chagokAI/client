import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotificationFeed } from '../src/notifications/feed.js'

class Source {
  static instances = []
  listeners = {}
  constructor(url, options) {
    this.url = url
    this.options = options
    Source.instances.push(this)
  }
  addEventListener(name, callback) {
    this.listeners[name] = callback
  }
  emit(name, data = {}) {
    this.listeners[name]?.({ data: JSON.stringify(data) })
  }
  close() {
    this.closed = true
  }
}
const tick = () => new Promise((resolve) => setImmediate(resolve))
const page = (items = []) => ({ items, unreadCount: items.filter((item) => item.unread).length })

test('loads existing notifications silently, shows new events once and reloads reads from another tab', async () => {
  let data = page([{ id: 'old', unread: true }])
  const snapshots = [],
    incoming = []
  const feed = createNotificationFeed(
    '/notifications/stream',
    async () => data,
    (value) => snapshots.push(value),
    {
      EventSourceImpl: Source,
      onNotification: (item) => incoming.push(item),
    },
  )
  try {
    feed.start()
    await tick()
    const source = Source.instances.at(-1)
    assert.equal(source.options.withCredentials, true)
    assert.equal(snapshots.at(-1).unreadCount, 1)
    assert.equal(incoming.length, 0)
    data = page([{ id: 'new', unread: true }, ...data.items])
    source.emit('changed', { notification: data.items[0] })
    source.emit('changed', { notification: data.items[0] })
    await tick()
    assert.equal(incoming.length, 1)
    assert.equal(snapshots.at(-1).unreadCount, 2)
    data = page(data.items.map((item) => ({ ...item, unread: false })))
    source.emit('changed', { refresh: true })
    await tick()
    assert.equal(snapshots.at(-1).unreadCount, 0)
    assert.equal(incoming.length, 1)
    feed.stop()
    source.emit('changed', { notification: { id: 'after-logout' } })
    assert.equal(incoming.length, 1)
    assert.equal(source.closed, true)
  } finally {
    feed.stop()
  }
})

test('a notification arriving during a request forces a fresh snapshot instead of restoring stale reads', async () => {
  const requests = [],
    snapshots = []
  const feed = createNotificationFeed(
    '/stream',
    () => new Promise((resolve) => requests.push(resolve)),
    (data) => snapshots.push(data),
    { EventSourceImpl: Source },
  )
  try {
    feed.start()
    Source.instances.at(-1).emit('changed', { refresh: true })
    requests[0](page([{ id: 'stale', unread: true }]))
    await tick()
    assert.equal(snapshots.length, 0)
    assert.equal(requests.length, 2)
    requests[1](page())
    await tick()
    assert.equal(snapshots.at(-1).unreadCount, 0)
  } finally {
    feed.stop()
  }
})

test('reconnect refreshes missed notifications; CLOSED retries and logout cancels retry and polling', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] })
  let calls = 0
  const feed = createNotificationFeed(
    '/stream',
    async () => {
      calls++
      return page()
    },
    () => {},
    { EventSourceImpl: Source },
  )
  feed.start()
  await tick()
  const source = Source.instances.at(-1)
  source.emit('connected')
  await tick()
  assert.equal(calls, 2)
  source.readyState = 2
  source.onerror()
  const before = Source.instances.length
  t.mock.timers.tick(10000)
  assert.equal(Source.instances.length, before + 1)
  Source.instances.at(-1).emit('connected')
  await tick()
  assert.equal(calls, 3)
  t.mock.timers.tick(20000)
  await tick()
  assert.equal(calls, 4)
  const last = Source.instances.at(-1)
  last.readyState = 2
  last.onerror()
  feed.stop()
  t.mock.timers.tick(60000)
  await tick()
  assert.equal(Source.instances.length, before + 1)
  assert.equal(calls, 4)
})

test('logout aborts an in-flight load and ignores its late result', async () => {
  let resolve, signal
  const snapshots = []
  const feed = createNotificationFeed(
    '/stream',
    (input) => {
      signal = input
      return new Promise((done) => {
        resolve = done
      })
    },
    (data) => snapshots.push(data),
    { EventSourceImpl: Source },
  )
  feed.start()
  feed.stop()
  assert.equal(signal.aborted, true)
  resolve(page([{ id: 'private', unread: true }]))
  await tick()
  assert.equal(snapshots.length, 0)
})
