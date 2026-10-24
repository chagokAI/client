import test from 'node:test'
import assert from 'node:assert/strict'
import { createLiveInputControl } from '../src/live/input.js'

const paused = { available: true, running: false, pending: 0 }
const flush = async () => {
  for (let i = 0; i < 8; i++) await new Promise((r) => queueMicrotask(r))
}

test('opening the view only reads state; Play and Pause explicitly change server input', async () => {
  const writes = []
  let last
  const run = createLiveInputControl(
    async () => paused,
    async (running) => {
      writes.push(running)
      return { ...paused, running }
    },
    (value) => {
      last = value
    },
  )
  await run.load()
  assert.deepEqual(writes, [])
  assert.equal(last.phase, 'paused')
  await run.toggle()
  assert.deepEqual(writes, [true])
  assert.equal(last.phase, 'running')
  await run.toggle()
  assert.deepEqual(writes, [true, false])
  assert.equal(last.phase, 'paused')
  await run.dispose()
})

test('pause remains stopping until accepted items finish rather than pretending stock is frozen', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let last
  let reads = 0
  const run = createLiveInputControl(
    async () => {
      reads++
      return paused
    },
    async (running) => ({ ...paused, running, pending: running ? 0 : 2 }),
    (value) => {
      last = value
    },
  )
  await run.load()
  await run.toggle()
  const stop = run.toggle()
  await flush()
  assert.equal(last.phase, 'stopping')
  t.mock.timers.tick(250)
  await stop
  assert.equal(last.phase, 'paused')
  assert.equal(reads, 2)
  await run.dispose()
})

test('repeated Play clicks send only one start request', async () => {
  let complete
  const writes = []
  const run = createLiveInputControl(
    async () => paused,
    (running) => {
      writes.push(running)
      return running
        ? new Promise((r) => {
            complete = r
          })
        : Promise.resolve(paused)
    },
    () => {},
  )
  await run.load()
  const first = run.toggle()
  const duplicate = run.toggle()
  await flush()
  assert.deepEqual(writes, [true])
  complete({ ...paused, running: true })
  await Promise.all([first, duplicate])
  await run.dispose()
})

test('leaving during start queues stop after start finishes and never notifies the departed view', async () => {
  let complete
  const writes = []
  let notifications = 0
  const run = createLiveInputControl(
    async () => paused,
    (running) => {
      writes.push(running)
      return running
        ? new Promise((r) => {
            complete = r
          })
        : Promise.resolve(paused)
    },
    () => {
      notifications++
    },
  )
  await run.load()
  const start = run.toggle()
  await flush()
  const afterLeaving = notifications
  const leaving = run.dispose()
  assert.deepEqual(writes, [true])
  complete({ ...paused, running: true })
  await Promise.all([start, leaving])
  assert.deepEqual(writes, [true, false])
  assert.equal(notifications, afterLeaving)
})

test('an observer who did not press Play does not stop another operator on leaving', async () => {
  const writes = []
  const run = createLiveInputControl(
    async () => ({ ...paused, running: true }),
    async (running) => {
      writes.push(running)
      return paused
    },
    () => {},
  )
  await run.load()
  await run.dispose()
  assert.deepEqual(writes, [])
})

test('leaving requests an owner-scoped stop while the Pause button stays explicit', async () => {
  const writes = []
  const run = createLiveInputControl(
    async () => paused,
    async (running, options) => {
      writes.push({ running, ownedOnly: options.ownedOnly })
      return { ...paused, running }
    },
    () => {},
  )
  await run.load()
  await run.toggle()
  await run.toggle()
  await run.toggle()
  await run.dispose()
  assert.deepEqual(writes, [
    { running: true, ownedOnly: false },
    { running: false, ownedOnly: false },
    { running: true, ownedOnly: false },
    { running: false, ownedOnly: true },
  ])
})

test('after Pause is accepted, another operators restart is not owned by this view', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let reads = 0
  const writes = []
  const run = createLiveInputControl(
    async () => (++reads === 1 ? paused : { ...paused, running: true }),
    async (running) => {
      writes.push(running)
      return { ...paused, running, pending: running ? 0 : 1 }
    },
    () => {},
  )
  await run.load()
  await run.toggle()
  const stop = run.toggle()
  await flush()
  t.mock.timers.tick(250)
  await stop
  await run.dispose()
  assert.deepEqual(writes, [true, false])
})

test('a failed state read can be retried without accidentally starting input', async () => {
  let reads = 0
  let last
  const writes = []
  const run = createLiveInputControl(
    async () => {
      if (++reads === 1) throw new Error('offline')
      return paused
    },
    async (running) => {
      writes.push(running)
      return paused
    },
    (value) => {
      last = value
    },
  )
  await run.load()
  assert.equal(last.phase, 'error')
  await run.toggle()
  assert.equal(last.phase, 'paused')
  assert.deepEqual(writes, [])
  await run.dispose()
})

test('a delayed start and leave finish before a new view starts input', async () => {
  const writes = []
  let release
  let running = false
  const make = (name) =>
    createLiveInputControl(
      async () => ({ ...paused, running }),
      async (next) => {
        writes.push([name, next])
        if (name === 'old' && next)
          await new Promise((resolve) => {
            release = resolve
          })
        running = next
        return { ...paused, running }
      },
      () => {},
    )
  const old = make('old')
  await old.load()
  const current = make('current')
  await current.load()
  const starting = old.toggle()
  await flush()
  const leaving = old.dispose()
  const restarting = current.toggle()
  await flush()
  release()
  await Promise.all([starting, leaving, restarting])
  assert.deepEqual(writes, [
    ['old', true],
    ['old', false],
    ['current', true],
  ])
  assert.equal(running, true)
  await current.dispose()
})

test('a new view reads status after the previous views stop has finished', async () => {
  let running = false
  let release
  const old = createLiveInputControl(
    async () => ({ ...paused, running }),
    async (next) => {
      if (!next)
        await new Promise((resolve) => {
          release = resolve
        })
      running = next
      return { ...paused, running }
    },
    () => {},
  )
  await old.load()
  await old.toggle()
  const leaving = old.dispose()
  await flush()
  let latest
  const current = createLiveInputControl(
    async () => ({ ...paused, running }),
    async () => paused,
    (value) => {
      latest = value
    },
  )
  const loading = current.load()
  await flush()
  release()
  await Promise.all([leaving, loading])
  assert.equal(latest.phase, 'paused')
  await current.dispose()
})

test('an observer picks up a run another operator started, without a loading flash', async () => {
  const states = [paused, { ...paused, running: true }]
  const phases = []
  const run = createLiveInputControl(
    async () => states.shift() ?? { ...paused, running: true },
    async () => assert.fail('an observer refresh must never write'),
    (value) => phases.push(value.phase),
  )
  await run.load()
  assert.equal(phases.at(-1), 'paused')
  const before = phases.length
  await run.refresh()
  assert.deepEqual(phases.slice(before), ['running'])
})

test('a failed background refresh keeps the last known phase', async () => {
  let fail = false
  const phases = []
  const run = createLiveInputControl(
    async () => {
      if (fail) throw new Error('network')
      return paused
    },
    async () => paused,
    (value) => phases.push(value.phase),
  )
  await run.load()
  fail = true
  await run.refresh()
  assert.equal(phases.at(-1), 'paused')
})
