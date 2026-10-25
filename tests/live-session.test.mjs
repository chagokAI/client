import test from 'node:test'
import assert from 'node:assert/strict'
import { createLiveInputSession } from '../src/live/session.js'

const paused = { available: true, running: false, pending: 0 }
const flush = async () => {
  for (let i = 0; i < 12; i++) await new Promise((resolve) => queueMicrotask(resolve))
}

test('navigation keeps server input running and the returning view can pause the same run', async () => {
  let running = false
  const writes = []
  const session = createLiveInputSession(
    async () => ({ ...paused, running }),
    async (next, options) => {
      running = next
      writes.push({ next, ...options })
      return { ...paused, running }
    },
  )
  try {
    const first = session.attach(() => {})
    await flush()
    await first.toggle()
    first.detach()
    await flush()
    assert.equal(running, true)
    assert.deepEqual(
      writes.map((write) => write.next),
      [true],
    )
    let returned
    const second = session.attach((value) => {
      returned = value
    })
    await flush()
    assert.equal(returned.phase, 'running')
    await second.toggle()
    assert.equal(returned.phase, 'paused')
    assert.deepEqual(
      writes.map((write) => write.next),
      [true, false],
    )
    assert.equal(writes[0].controlId, writes[1].controlId)
    second.detach()
  } finally {
    await session.dispose()
  }
})

test('a start finishing after navigation updates the new view without sending an implicit stop', async () => {
  let finish,
    running = false,
    oldUpdates = 0,
    latest
  const writes = []
  const session = createLiveInputSession(
    async () => ({ ...paused, running }),
    async (next) => {
      writes.push(next)
      if (next)
        await new Promise((resolve) => {
          finish = resolve
        })
      running = next
      return { ...paused, running }
    },
  )
  try {
    const first = session.attach(() => {
      oldUpdates++
    })
    await flush()
    const starting = first.toggle()
    await flush()
    first.detach()
    const updatesBeforeLeaving = oldUpdates
    const second = session.attach((value) => {
      latest = value
    })
    finish()
    await starting
    assert.equal(oldUpdates, updatesBeforeLeaving)
    assert.equal(latest.phase, 'running')
    assert.deepEqual(writes, [true])
    second.detach()
  } finally {
    await session.dispose()
  }
})

test('browser exit and logout still stop an owned run even while another route is open', async () => {
  const target = new EventTarget()
  let running = false,
    latest
  const writes = []
  const session = createLiveInputSession(
    async () => ({ ...paused, running }),
    async (next, options) => {
      running = next
      writes.push({ next, ownedOnly: options.ownedOnly })
      return { ...paused, running }
    },
    { target },
  )
  const view = session.attach(() => {})
  await flush()
  await view.toggle()
  view.detach()
  target.dispatchEvent(new Event('pagehide'))
  await flush()
  assert.equal(running, false)
  assert.deepEqual(writes, [
    { next: true, ownedOnly: false },
    { next: false, ownedOnly: true },
  ])
  target.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true }))
  await flush()
  const returning = session.attach((value) => {
    latest = value
  })
  await flush()
  assert.equal(latest.phase, 'paused')
  await returning.toggle()
  returning.detach()
  await session.dispose()
  assert.equal(running, false)
  assert.deepEqual(writes.at(-1), { next: false, ownedOnly: true })
})

test('leaving an observer session never stops another operators input', async () => {
  const session = createLiveInputSession(
    async () => ({ ...paused, running: true }),
    async () => assert.fail('observing another run must not send a stop'),
  )
  const view = session.attach(() => {})
  await flush()
  view.detach()
  await session.dispose()
})
