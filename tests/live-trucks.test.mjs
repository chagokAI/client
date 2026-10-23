import test from 'node:test'
import assert from 'node:assert/strict'
import { createLiveTruckFlow } from '../src/live/trucks.js'
import * as THREE from 'three'
import { World, makePackedBox } from '../src/digital-twin/scene.js'

// WebGL 출력을 대신하는 경계다. 적재 위치 계산은 실제 Truck 클래스를 사용한다.
function display() {
  const landed = []
  const world = {
    truckMm: [2800, 1600, 1600],
    flights: [],
    busy() {
      return this.flights.length > 0
    },
    finishAll() {
      for (const f of this.flights) if (f.event) landed.push(f)
      this.flights = []
    },
    beginBulk() {},
    endBulk() {},
    pruneTrucks(line, keep) {
      line.trucks.splice(0, Math.max(0, line.trucks.length - keep))
    },
  }
  const line = {
    trucks: [{ no: 1 }],
    current() {
      return this.trucks.at(-1)
    },
    swapTruck(no, duration) {
      assert.equal(world.busy(), false, 'never switch a truck while its boxes are moving')
      this.trucks.push({ no })
      if (duration) world.flights.push({ kind: 'move', line, done: false })
    },
    push(event, duration) {
      const flight = { event, truck: this.current().no, duration }
      if (duration) world.flights.push(flight)
      else landed.push(flight)
    },
  }
  world.lines = [line]
  return { world, line, landed }
}

function item(id, dims = [200, 200, 200]) {
  return {
    eventId: String(id),
    product: { name: '등록 물품' },
    itemMm: { widthMm: 100, depthMm: 80, heightMm: 50 },
    fillRatePct: 12.34,
    box: {
      id: 'assigned',
      code: 'server-choice',
      innerWidthMm: dims[0],
      innerDepthMm: dims[1],
      innerHeightMm: dims[2],
      onHandQty: 300 - id,
      version: id,
    },
  }
}

test('uses the server box at its original dimensions, preserving allocation and stock', () => {
  const { world, landed } = display()
  const flow = createLiveTruckFlow(world)
  const event = item(1, [700, 500, 400])
  Object.freeze(event.box)
  Object.freeze(event)
  assert.equal(flow.accept(event), true)
  flow.pump(0)
  world.finishAll()
  assert.equal(landed[0].event.box.code, 'server-choice')
  assert.deepEqual(landed[0].event.box.dims, [700, 500, 400])
  assert.deepEqual(landed[0].event.box.size, [500, 700, 400])
  assert.deepEqual(landed[0].event.box.pos, [0, 0, 0])
  assert.equal(landed[0].event.box.stockAfter, 299)
  assert.equal(landed[0].event.box.fill, 12.34)
  assert.equal(landed[0].duration, 4 / 3, 'six items/sec uses the same travel time as simulation')
  assert.equal(event.box.onHandQty, 299)
  assert.deepEqual(
    landed[0].event.serverItem,
    event,
    'a retained box keeps its server detail after the recent log expires',
  )
})

test('retains placement beyond 120 items and packs layers inside the truck without overlap', () => {
  const { world, landed } = display()
  const flow = createLiveTruckFlow(world)
  for (let i = 1; i <= 160; i++) {
    flow.accept(item(i))
    flow.pump(i * 167)
  }
  world.finishAll()
  assert.equal(landed.length, 160)
  assert.ok(landed.every((f) => f.truck === 1))
  assert.ok(
    landed.some((f) => f.event.box.pos[2] > 0),
    'uses stacked space rather than a flat grid',
  )
  const boxes = landed.map((f) => f.event.box)
  for (const [i, box] of boxes.entries()) {
    assert.ok(box.pos.every((p, axis) => p >= 0 && p + box.size[axis] <= [2800, 1600, 1600][axis]))
    for (const other of boxes.slice(0, i)) {
      assert.ok(
        box.pos.some((p, axis) => p >= other.pos[axis] + other.size[axis] || other.pos[axis] >= p + box.size[axis]),
        'boxes cannot intersect',
      )
    }
  }
})

test('queues the next truck until all current items and the truck movement have finished', () => {
  const { world, line, landed } = display()
  const flow = createLiveTruckFlow(world)
  for (let i = 1; i <= 3; i++) {
    flow.accept(item(i, [1000, 1000, 1000]))
    flow.pump((i - 1) * 167)
  }
  assert.equal(line.current().no, 1)
  assert.equal(flow.pending, 1)
  world.finishAll()
  flow.pump(500)
  assert.equal(line.current().no, 2)
  assert.equal(flow.pending, 1, 'wait for the incoming truck before showing its first item')
  flow.pump(500)
  assert.equal(flow.pending, 1, 'a frame during the incoming movement must not launch the item')
  world.finishAll()
  flow.pump(1999)
  assert.equal(flow.pending, 1, 'uses the simulation truck transition time of 1.5 seconds')
  flow.pump(2000)
  world.finishAll()
  assert.deepEqual(
    landed.map((f) => [f.event.eventId, f.truck]),
    [
      ['1', 1],
      ['2', 1],
      ['3', 2],
    ],
  )
})

test('an oversized or invalid box is unplaced without changing packing success or creating trucks', () => {
  const { world, line } = display()
  const flow = createLiveTruckFlow(world)
  const oversized = item(1, [3000, 2000, 1700])
  assert.equal(flow.accept(oversized), false)
  assert.equal(flow.accept(item(2, [0, 10, 20])), false)
  flow.pump()
  assert.equal(flow.unplaced, 2)
  assert.equal(flow.pending, 0)
  assert.equal(line.trucks.length, 1)
  assert.equal(oversized.box.onHandQty, 299)
})

test('a backlog stays FIFO without instant bulk loading and retains only recent completed trucks', () => {
  const { world, line, landed } = display()
  const flow = createLiveTruckFlow(world)
  for (let i = 1; i <= 180; i++) {
    flow.accept(item(i, [1000, 1000, 1000]))
  }
  assert.equal(landed.length, 0, 'receiving data must never skip animation or load a batch')
  assert.equal(flow.pending, 180)
  for (let now = 0; flow.pending && now < 600000; now += 167) {
    flow.pump(now)
    world.finishAll()
  }
  assert.equal(landed.length, 180)
  assert.equal(new Set(landed.map((f) => f.event.eventId)).size, 180)
  assert.ok(landed.every((f) => f.event.box.truck === f.truck))
  assert.equal(line.current().no, 90)
  assert.ok(line.trucks.length <= 4)
})

test('a six-item arrival starts one item per interval rather than a six-item clump', () => {
  const { world, landed } = display()
  const flow = createLiveTruckFlow(world)
  for (let i = 1; i <= 6; i++) flow.accept(item(i))
  flow.pump(0)
  assert.equal(world.flights.length, 1)
  flow.pump(0)
  flow.pump(166)
  assert.equal(world.flights.length, 1)
  flow.pump(167)
  assert.equal(world.flights.length, 2)
  for (const now of [334, 501, 668, 835]) flow.pump(now)
  world.finishAll()
  assert.deepEqual(
    landed.map((f) => f.event.eventId),
    ['1', '2', '3', '4', '5', '6'],
  )
})

test('a delayed frame starts only one item and does not replay all elapsed intervals', () => {
  const { world } = display()
  const flow = createLiveTruckFlow(world)
  for (let i = 1; i <= 6; i++) flow.accept(item(i))
  flow.pump(0)
  flow.pump(10000)
  assert.equal(world.flights.length, 2)
  flow.pump(10000)
  flow.pump(10166)
  assert.equal(world.flights.length, 2)
  flow.pump(10167)
  assert.equal(world.flights.length, 3)
})

test('pause finishes the current flight without starting queued items until playback resumes', () => {
  const { world, landed } = display()
  const flow = createLiveTruckFlow(world)
  for (let i = 1; i <= 6; i++) flow.accept(item(i))
  flow.pump(0, true)
  flow.pump(1000, false)
  assert.equal(world.flights.length, 1)
  world.finishAll()
  flow.pump(2000, false)
  assert.equal(landed.length, 1)
  assert.equal(world.flights.length, 0)
  flow.pump(3000, true)
  assert.equal(world.flights.length, 1)
  assert.equal(flow.pending, 4)
})

test('pruning completed trucks releases individual GPU resources and preserves shared box and sprite assets', () => {
  const world = Object.create(World.prototype)
  world.flights = []
  world.selectables = []
  const line = {
    group: new THREE.Group(),
    trucks: [],
    packed: [],
    _parkSlot: (i) => new THREE.Vector3(i * 5, 0, 4),
  }
  let disposedGeometry = 0
  let disposedTexture = 0
  let disposedMaterial = 0
  let disposedShared = 0
  for (let no = 1; no <= 6; no++) {
    const group = new THREE.Group()
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.6, 1.6), new THREE.MeshBasicMaterial())
    cargo.geometry.addEventListener('dispose', () => disposedGeometry++)
    cargo.material.addEventListener('dispose', () => disposedMaterial++)
    const texture = new THREE.Texture()
    texture.addEventListener('dispose', () => disposedTexture++)
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }))
    const box = makePackedBox([200, 200, 200], [100, 80, 50], '#aaaaaa')
    if (no === 1) {
      for (const g of [
        box.userData.shell.geometry,
        box.userData.edges.geometry,
        box.userData.item.geometry,
        label.geometry,
      ])
        g.addEventListener('dispose', () => disposedShared++)
      box.userData.item.material.addEventListener('dispose', () => disposedShared++)
    }
    group.add(cargo, label, box)
    line.group.add(group)
    line.trucks.push({ no, group, boxes: [{ eventId: String(no) }] })
    line.packed.push({ group: box, event: { eventId: String(no) } })
    world.selectables.push(cargo, box.userData.shell)
  }
  world.pruneTrucks(line, 4)
  assert.deepEqual(
    line.trucks.map((t) => t.no),
    [3, 4, 5, 6],
  )
  assert.equal(line.group.children.length, 4)
  assert.equal(line.packed.length, 4)
  assert.equal(world.selectables.length, 8)
  assert.equal(disposedGeometry, 2)
  assert.equal(disposedMaterial, 2)
  assert.equal(disposedTexture, 2)
  assert.equal(disposedShared, 0)
  world.flights.push({ line, done: false })
  world.pruneTrucks(line, 1)
  assert.equal(line.trucks.length, 4, 'active movements protect their trucks from pruning')
})
