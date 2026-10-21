import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// 단위: 3D 1 = 1m. 데이터는 mm.
const MM = 0.001
const BELT_Y = 0.8          // 컨베이어 윗면 높이
const START_X = -7.5        // 물품이 들어오는 곳
const GATE_X = -4.2         // DL 측정 게이트
const PACK_X = -0.6         // 포장대
const DOOR_X = 1.4          // 트럭 적재함 문(뒤쪽) 위치
const TRUCK_FLOOR = 0.9
const PARK_Z = -4.2         // 출발한 트럭이 줄지어 서는 곳

export const CODE_COLORS = ['#e07a5f', '#3d85c6', '#81b29a', '#f2cc8f', '#9b5de5', '#f15bb5', '#00a6a6', '#8d6e63',
  '#5c6bc0', '#ef8354']

export function fillColor(fill) {
  // 낮음(빨강) → 높음(초록)
  const t = Math.max(0, Math.min(1, (fill ?? 0) / 80))
  return new THREE.Color().setHSL(0.0 + 0.33 * t, 0.7, 0.5)
}

function textSprite(text, { size = 64, color = '#202a38', bg = 'rgba(255,255,255,0.9)' } = {}) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = `600 ${size}px sans-serif`
  const lines = String(text).split('\n')
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size
  c.width = w
  c.height = lines.length * size * 1.3 + size * 0.4
  ctx.font = `600 ${size}px sans-serif`
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.fillStyle = color
  lines.forEach((l, i) => ctx.fillText(l, size / 2, size * 1.1 + i * size * 1.3))
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }))
  s.scale.set(c.width / 400, c.height / 400, 1)
  s.renderOrder = 10
  return s
}

/** 상자 축(정렬된 크기)에 물품 치수를 큰 변끼리 맞춰 넣는다 */
export function itemInBoxSize(boxSize, itemDims) {
  const order = [0, 1, 2].sort((a, b) => boxSize[b] - boxSize[a])
  const item = [...itemDims].sort((a, b) => b - a)
  const out = [0, 0, 0]
  order.forEach((axis, i) => { out[axis] = item[i] })
  return out
}

export function makePackedBox(boxSize, itemDims, color) {
  // boxSize: [x(길이), y(폭), z(높이)] mm, 3D 축은 (x, z→y, y→z)
  const g = new THREE.Group()
  const [sx, sy, sz] = boxSize
  const geo = new THREE.BoxGeometry(sx * MM, sz * MM, sy * MM)
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
  const shell = new THREE.Mesh(geo, mat)
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }))
  g.add(shell, edges)
  const [ix, iy, iz] = itemInBoxSize(boxSize, itemDims)
  const item = new THREE.Mesh(new THREE.BoxGeometry(ix * MM, iz * MM, iy * MM),
    new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.8 }))
  item.position.set((ix - sx) * MM / 2, (iz - sz) * MM / 2, (iy - sy) * MM / 2)   // 바닥 한쪽 구석
  g.add(item)
  g.userData = { shell, edges, item }
  return g
}

export function setBoxColor(group, color) {
  group.userData.shell.material.color.set(color)
  group.userData.edges.material.color.set(color)
}

export class World {
  constructor(el, { onSelect }) {
    this.el = el
    this.onSelect = onSelect
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    el.appendChild(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#eef1f4')
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200)
    this.camera.position.set(-1.5, 6.5, 9.5)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(-0.5, 0.8, 0)
    this.controls.enableDamping = true
    this.clock = new THREE.Clock()
    this.flights = []          // 날아가는 물품·상자 애니메이션
    this.packed = []           // 트럭에 실린 상자 { group, event }
    this.trucks = []           // { no, group, boxes: [] }
    this.selectables = []
    this.colorMode = 'code'
    this.codeColor = {}
    this._build()
    this._resize()
    this.resizer = new ResizeObserver(() => this._resize())   // 패널 크기가 바뀌어도 캔버스를 맞춘다
    this.resizer.observe(el)
    this.renderer.domElement.addEventListener('click', (e) => this._pick(e))
    this.renderer.setAnimationLoop(() => this._tick())
  }

  /** 화면을 떠날 때 WebGL 자원과 감시를 정리한다 */
  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resizer.disconnect()
    this.controls.dispose()
    this.scene.traverse((o) => {
      o.geometry?.dispose()
      if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose() })
    })
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  _build() {
    const s = this.scene
    s.add(new THREE.HemisphereLight('#ffffff', '#b9b2a6', 1.6))
    const sun = new THREE.DirectionalLight('#ffffff', 1.4)
    sun.position.set(-4, 9, 6)
    sun.castShadow = true
    s.add(sun)
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), new THREE.MeshStandardMaterial({ color: '#dcd7cf' }))
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    s.add(floor)
    s.add(new THREE.GridHelper(40, 40, '#c9c2b6', '#d3cdc3'))

    // 컨베이어
    const len = PACK_X - START_X + 0.4
    const belt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.8), new THREE.MeshStandardMaterial({ color: '#3b4250' }))
    belt.position.set(START_X + len / 2 - 0.2, BELT_Y - 0.04, 0)
    s.add(belt)
    for (let x = START_X; x <= PACK_X; x += 0.9) {
      for (const z of [-0.35, 0.35]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, BELT_Y - 0.08, 0.06), new THREE.MeshStandardMaterial({ color: '#8a8f99' }))
        leg.position.set(x, (BELT_Y - 0.08) / 2, z)
        s.add(leg)
      }
    }
    const inLabel = textSprite('입고')
    inLabel.position.set(START_X, BELT_Y + 0.6, 0)
    s.add(inLabel)

    // DL 측정 게이트
    const gate = new THREE.Group()
    const postMat = new THREE.MeshStandardMaterial({ color: '#603c22' })
    for (const z of [-0.55, 0.55]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), postMat)
      post.position.set(0, 0.95, z)
      gate.add(post)
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.2), postMat)
    top.position.y = 1.9
    gate.add(top)
    this.scan = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0),
      new THREE.MeshBasicMaterial({ color: '#33c3ff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }))
    this.scan.rotation.y = Math.PI / 2
    this.scan.position.y = BELT_Y + 0.5
    gate.add(this.scan)
    gate.position.x = GATE_X
    s.add(gate)
    const gl = textSprite('DL 측정')
    gl.position.set(GATE_X, 2.3, 0)
    s.add(gl)
    this.gateReadout = null

    // 포장대
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.0, BELT_Y, 1.2), new THREE.MeshStandardMaterial({ color: '#b08b5b' }))
    table.position.set(PACK_X + 0.2, BELT_Y / 2, 0)
    s.add(table)
    const pl = textSprite('박스 선택·포장')
    pl.position.set(PACK_X + 0.2, 2.0, 0)
    s.add(pl)
    // 담을 박스가 없는 물품
    const bin = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: '#ba3b32', transparent: true, opacity: 0.6 }))
    bin.position.set(PACK_X + 0.2, 0.25, 1.6)
    s.add(bin)
    const bl = textSprite('맞는 박스 없음')
    bl.position.set(PACK_X + 0.2, 1.0, 1.6)
    s.add(bl)
    this.binCount = 0
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.el
    this.renderer.setSize(w, h)
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
  }

  reset(truckMm, boxes) {
    for (const t of this.trucks) this.scene.remove(t.group)
    for (const f of this.flights) this.scene.remove(f.obj)
    this.trucks = []
    this.packed = []
    this.flights = []
    this.selectables = []
    this.truckMm = truckMm
    this.binCount = 0
    this.codeColor = Object.fromEntries(boxes.map((b, i) => [b.code, CODE_COLORS[i % CODE_COLORS.length]]))
    this._newTruck(1, true)
  }

  _truckGroup(no) {
    const [L, W, H] = this.truckMm.map((v) => v * MM)
    const g = new THREE.Group()
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(L, H, W),
      new THREE.MeshStandardMaterial({ color: '#9fb3c8', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }))
    cargo.position.set(L / 2, TRUCK_FLOOR + H / 2, 0)
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(cargo.geometry), new THREE.LineBasicMaterial({ color: '#4b6178' }))
    frame.position.copy(cargo.position)
    const bed = new THREE.Mesh(new THREE.BoxGeometry(L + 1.6, 0.15, W + 0.1), new THREE.MeshStandardMaterial({ color: '#3b4250' }))
    bed.position.set(L / 2 + 0.8, TRUCK_FLOOR - 0.08, 0)
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, W + 0.1), new THREE.MeshStandardMaterial({ color: '#f2f2f2' }))
    cab.position.set(L + 0.85, TRUCK_FLOOR + 0.75, 0)
    g.add(cargo, frame, bed, cab)
    for (const x of [0.6, L + 0.9]) {
      for (const z of [-W / 2, W / 2]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.25, 20), new THREE.MeshStandardMaterial({ color: '#222' }))
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(x, 0.38, z)
        g.add(wheel)
      }
    }
    const label = textSprite(`트럭 ${no}`)
    label.position.set(L / 2, TRUCK_FLOOR + H + 0.45, 0)
    g.add(label)
    cargo.userData.truckNo = no
    this.selectables.push(cargo)
    return g
  }

  _newTruck(no, instant = false) {
    const g = this._truckGroup(no)
    g.position.set(instant ? DOOR_X : DOOR_X + 12, 0, 0)
    this.scene.add(g)
    const t = { no, group: g, boxes: [], target: new THREE.Vector3(DOOR_X, 0, 0) }
    this.trucks.push(t)
    if (!instant) this.flights.push({ obj: g, kind: 'move', from: g.position.clone(), to: t.target.clone(), t: 0, dur: 1.2 })
    return t
  }

  current() {
    return this.trucks[this.trucks.length - 1]
  }

  /** 꽉 찬 트럭은 출발해 옆 줄에 서고(누적), 새 트럭이 들어온다 */
  swapTruck(no, duration) {
    const old = this.current()
    const parked = this.trucks.length - 1          // 이미 출발해 서 있는 트럭 수
    const to = new THREE.Vector3(DOOR_X + 1.0, 0, PARK_Z - parked * 2.4)
    this.flights.push({ obj: old.group, kind: 'move', from: old.group.position.clone(), to, t: 0, dur: duration })
    const t = this._newTruck(no)
    this.flights[this.flights.length - 1].dur = duration
    return t
  }

  boxColor(ev) {
    return this.colorMode === 'fill' ? fillColor(ev.box.fill) : this.codeColor[ev.box.code] ?? '#999'
  }

  setColorMode(mode) {
    this.colorMode = mode
    for (const p of this.packed) setBoxColor(p.group, this.boxColor(p.event))
  }

  /** 물품 한 건을 컨베이어 → 측정 → 포장 → 트럭으로 흘린다. duration: 전체 걸리는 시간(초), 0이면 바로 적재 */
  push(ev, duration) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(...[ev.item.dims[0], ev.item.dims[2], ev.item.dims[1]].map((v) => v * MM)),
      new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.8 }))
    item.castShadow = true
    const h = ev.item.dims[2] * MM
    item.position.set(START_X, BELT_Y + h / 2, 0)
    this.scene.add(item)
    const f = { obj: item, kind: 'item', ev, t: 0, dur: Math.max(duration, 0.0001), h, scanned: false, packed: false }
    this.flights.push(f)
    if (duration === 0) this._advance(f, 1)
  }

  _advance(f, p) {
    // 0~0.45 컨베이어→게이트, 0.45~0.55 측정, 0.55~0.75 포장대, 0.75~1 트럭
    const ev = f.ev
    if (p < 0.45) {
      f.obj.position.x = START_X + (GATE_X - START_X) * (p / 0.45)
    } else if (p < 0.55) {
      f.obj.position.x = GATE_X
      if (!f.scanned) {
        f.scanned = true
        this.scan.material.opacity = 0.55
        this._readout(`${ev.item.dims.join('×')} mm\n${ev.item.source}`)
      }
    } else if (p < 0.75) {
      f.obj.position.x = GATE_X + (PACK_X - GATE_X) * ((p - 0.55) / 0.2)
    } else if (!ev.box) {
      if (!f.packed) {
        f.packed = true
        f.from = f.obj.position.clone()
        this.binCount += 1
      }
      const q = (p - 0.75) / 0.25
      f.obj.position.lerpVectors(f.from, new THREE.Vector3(PACK_X + 0.2, 0.55 + (this.binCount % 5) * 0.05, 1.6), q)
    } else {
      if (!f.packed) {
        f.packed = true
        this.scene.remove(f.obj)
        const g = makePackedBox(ev.box.size, ev.item.dims, this.boxColor(ev))
        g.position.set(PACK_X + 0.2, BELT_Y + ev.box.size[2] * MM / 2, 0)
        this.scene.add(g)
        f.obj = g
        f.from = g.position.clone()
        f.truck = this.current()
        const [L, W] = this.truckMm
        const [px, py, pz] = ev.box.pos
        const [sx, sy, sz] = ev.box.size
        // 트럭 좌표 x=0 이 운전석 쪽(안쪽). 문은 DOOR_X 쪽
        f.local = new THREE.Vector3((L - px - sx / 2) * MM, TRUCK_FLOOR + (pz + sz / 2) * MM, (py + sy / 2 - W / 2) * MM)
      }
      const q = (p - 0.75) / 0.25
      const dest = f.local.clone().add(f.truck.group.position)
      const pos = new THREE.Vector3().lerpVectors(f.from, dest, q)
      pos.y += Math.sin(q * Math.PI) * 0.8
      f.obj.position.copy(pos)
    }
    if (p >= 1) this._land(f)
  }

  _land(f) {
    f.done = true
    const ev = f.ev
    if (!ev.box) return
    f.truck.group.attach(f.obj)
    f.obj.position.copy(f.local)
    f.obj.userData.shell.userData.event = ev
    this.selectables.push(f.obj.userData.shell)
    this.packed.push({ group: f.obj, event: ev })
    f.truck.boxes.push(ev)
  }

  _readout(text) {
    if (this.gateReadout) this.scene.remove(this.gateReadout)
    this.gateReadout = textSprite(text, { size: 48 })
    this.gateReadout.position.set(GATE_X, 2.85, 0)
    this.scene.add(this.gateReadout)
  }

  busy() {
    return this.flights.some((f) => !f.done)
  }

  _tick() {
    const dt = Math.min(this.clock.getDelta(), 0.1)
    for (const f of this.flights) {
      if (f.done) continue
      f.t += dt
      const p = Math.min(1, f.t / f.dur)
      if (f.kind === 'move') {
        f.obj.position.lerpVectors(f.from, f.to, p * p * (3 - 2 * p))
        if (p >= 1) f.done = true
      } else {
        this._advance(f, p)
      }
    }
    this.flights = this.flights.filter((f) => !f.done)
    this.scan.material.opacity = Math.max(0, this.scan.material.opacity - dt * 1.5)
    this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  _pick(e) {
    const r = this.renderer.domElement.getBoundingClientRect()
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(v, this.camera)
    const hit = ray.intersectObjects(this.selectables, false)
    const box = hit.find((h) => h.object.userData.event)
    if (box) return this.onSelect({ type: 'box', event: box.object.userData.event })
    const truck = hit.find((h) => h.object.userData.truckNo)
    if (truck) this.onSelect({ type: 'truck', no: truck.object.userData.truckNo })
  }
}

/** 상세 패널의 작은 3D: 상자 하나와 안의 물품을 돌려 보여 준다 */
export class MiniView {
  constructor(el) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    el.appendChild(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.scene.add(new THREE.HemisphereLight('#fff', '#bbb', 2))
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 20)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.autoRotate = true
    this.el = el
    const w = el.clientWidth
    const h = el.clientHeight
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setAnimationLoop(() => {
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
    })
  }

  show(ev, color) {
    if (this.obj) this.scene.remove(this.obj)
    this.obj = makePackedBox(ev.box.size, ev.item.dims, color)
    this.obj.userData.shell.material.opacity = 0.22
    this.scene.add(this.obj)
    const r = Math.max(...ev.box.size) * MM
    this.camera.position.set(r * 1.4, r * 1.1, r * 1.6)
    this.controls.target.set(0, 0, 0)
  }

  dispose() {
    this.renderer.setAnimationLoop(null)
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
