import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// 단위: 3D 1 = 1m. 데이터는 mm.
const MM = 0.001
const BELT_Y = 0.8 // 컨베이어 윗면 높이
const START_X = -7.5 // 물품이 들어오는 곳
const GATE_X = -4.2 // DL 측정 게이트
const PACK_X = -0.6 // 포장대 앞(컨베이어가 끝나는 곳)
const STATION_X = PACK_X + 0.55 // 포장대 가운데 (컨베이어와 겹치지 않게 뒤로)
const DOOR_X = 1.4 // 트럭 적재함 문(뒤쪽) 위치
const TRUCK_FLOOR = 0.9
const PARK_Z = 4.2 // 출발한 트럭이 줄지어 서는 곳(라인에서 떨어진 거리)
export const LANE_Z = 5.2 // 제안 라인(두 번째 컨베이어)의 위치

export const CODE_COLORS = [
  '#e07a5f',
  '#3d85c6',
  '#81b29a',
  '#f2cc8f',
  '#9b5de5',
  '#f15bb5',
  '#00a6a6',
  '#8d6e63',
  '#5c6bc0',
  '#ef8354',
]

export function fillColor(fill) {
  // 낮음(빨강) → 높음(초록)
  const t = Math.max(0, Math.min(1, (fill ?? 0) / 80))
  return new THREE.Color().setHSL(0.0 + 0.33 * t, 0.7, 0.5)
}

function textSprite(
  text,
  { size = 64, color = '#bfeaff', bg = 'rgba(6,18,38,0.82)', border = 'rgba(76,201,255,0.7)' } = {},
) {
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  ctx.font = `600 ${size}px sans-serif`
  const lines = String(text).split('\n')
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + size
  c.width = w
  c.height = lines.length * size * 1.3 + size * 0.4
  ctx.font = `600 ${size}px sans-serif`
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.roundRect(2, 2, c.width - 4, c.height - 4, size * 0.3)
  ctx.fill()
  ctx.strokeStyle = border
  ctx.lineWidth = 3
  ctx.stroke()
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
  order.forEach((axis, i) => {
    out[axis] = item[i]
  })
  return out
}

// 같은 크기 상자는 형상을 같이 쓴다(수천 개를 실어도 메모리·렉이 늘지 않게)
const shellGeo = new Map()
function boxGeo(sx, sy, sz) {
  const key = `${sx}|${sy}|${sz}`
  if (!shellGeo.has(key)) {
    const geo = new THREE.BoxGeometry(sx * MM, sz * MM, sy * MM)
    shellGeo.set(key, { geo, edges: new THREE.EdgesGeometry(geo) })
  }
  return shellGeo.get(key)
}

const itemMat = new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.8 }) // 물품은 재질을 같이 쓴다

export function makePackedBox(boxSize, itemDims, color) {
  // boxSize: [x(길이), y(폭), z(높이)] mm, 3D 축은 (x, z→y, y→z)
  const g = new THREE.Group()
  const [sx, sy, sz] = boxSize
  const { geo, edges: edgeGeo } = boxGeo(sx, sy, sz)
  const mat = new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false })
  const shell = new THREE.Mesh(geo, mat)
  const edges = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color }))
  g.add(shell, edges)
  const [ix, iy, iz] = itemInBoxSize(boxSize, itemDims)
  const item = new THREE.Mesh(boxGeo(ix, iy, iz).geo, itemMat)
  item.position.set(((ix - sx) * MM) / 2, ((iz - sz) * MM) / 2, ((iy - sy) * MM) / 2) // 바닥 한쪽 구석
  g.add(item)
  g.userData = { shell, edges, item }
  return g
}

export function setBoxColor(group, color) {
  group.userData.shell.material.color.set(color)
  group.userData.edges.material.color.set(color)
}

/**
 * 3D 공간 전체: 조명·바닥·창고 배경과 작업 라인 두 줄(기존 라인, 제안 라인).
 * 라인마다 컨베이어·측정 게이트·포장대·로봇·진열대·트럭을 따로 가진다(Line).
 */
export class World {
  constructor(el, { onSelect }) {
    this.el = el
    this.onSelect = onSelect
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    el.appendChild(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#050b16')
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200)
    this.camera.position.set(-3.0, 10.5, 15.5)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.target.set(-0.8, 0.8, 2.4)
    this.controls.enableDamping = true
    this.clock = new THREE.Clock()
    this.flights = [] // 날아가는 물품·상자·트럭 애니메이션 { line, ... }
    this.selectables = []
    this.colorMode = 'code'
    this.codeColor = {}
    this._build()
    this.lines = [
      new Line(this, 0, { index: 0, name: '기존', title: '기존 라인 · 보유 박스', parkDir: -1 }),
      new Line(this, LANE_Z, { index: 1, name: '제안', title: '제안 라인 · 보유 + 신규 규격', parkDir: 1 }),
    ]
    this.lines[1].group.visible = false // 제안 라인은 비교 시뮬레이션에서만 보인다
    this._resize()
    this.resizer = new ResizeObserver(() => this._resize()) // 패널 크기가 바뀌어도 캔버스를 맞춘다
    this.resizer.observe(el)
    this.renderer.domElement.addEventListener('click', (e) => this._pick(e))
    this.renderer.setAnimationLoop(() => this._tick())
  }

  /** 화면을 떠날 때 WebGL 자원과 감시를 정리한다 */
  dispose() {
    this.renderer.setAnimationLoop(null)
    this.resizer.disconnect()
    this.controls.dispose()
    const seen = new Set()
    this.scene.traverse((o) => {
      if (o.geometry && !seen.has(o.geometry)) {
        seen.add(o.geometry)
        o.geometry.dispose()
      }
      if (o.material)
        [].concat(o.material).forEach((m) => {
          m.map?.dispose()
          m.dispose()
        })
    })
    shellGeo.clear()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  _build() {
    const s = this.scene
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    s.fog = new THREE.Fog('#050b16', 22, 55)
    s.add(new THREE.HemisphereLight('#9ec9ff', '#0a1424', 1.1))
    const sun = new THREE.DirectionalLight('#d6ecff', 1.6)
    sun.position.set(-5, 12, 10)
    sun.target.position.set(0, 0, 2.6)
    s.add(sun.target)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024) // 그림자는 태양 하나, 작은 맵(렉 방지)
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 11, bottom: -11, near: 1, far: 40 })
    s.add(sun)

    // 바닥: 짙은 남색 + 빛나는 격자
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(44, 36),
      new THREE.MeshStandardMaterial({ color: '#0a1628', metalness: 0.35, roughness: 0.45 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.z = 2.6
    floor.receiveShadow = true
    s.add(floor)
    const minor = new THREE.GridHelper(44, 88, '#0f2a4a', '#0f2a4a')
    minor.position.set(0, 0.002, 2.6)
    const major = new THREE.GridHelper(44, 22, '#1e6fb8', '#1e6fb8')
    major.position.set(0, 0.003, 2.6)
    major.material.transparent = true
    major.material.opacity = 0.55
    s.add(minor, major)
    this._buildWarehouse()
  }

  /** 물류센터 배경: 뒤쪽 고층 선반 한 줄(팔레트)·천장 조명 띠. 어둡고 은은하게, 인스턴스로 그린다 */
  _buildWarehouse() {
    const s = this.scene
    const m4 = new THREE.Matrix4()
    const steel = new THREE.MeshStandardMaterial({ color: '#1d3557', metalness: 0.6, roughness: 0.45 })
    const beamMat = new THREE.MeshStandardMaterial({
      color: '#c77b2b',
      metalness: 0.4,
      roughness: 0.5,
      emissive: '#2a1200',
    })
    const bays = []
    for (let x = -12.5; x <= -3.5; x += 2.3) bays.push([x, -7.2]) // 고층 선반 한 줄
    const levels = [0, 1.4, 2.8, 4.2]
    const uprights = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 5.0, 0.08), steel, bays.length * 4)
    const beams = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.3, 0.1, 0.06),
      beamMat,
      bays.length * levels.length * 2,
    )
    const pallets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.0, 0.12, 1.0),
      new THREE.MeshStandardMaterial({ color: '#4a3b2a', roughness: 0.9 }),
      bays.length * levels.length * 2,
    )
    const cartons = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.85 }),
      bays.length * levels.length * 2,
    )
    let ui = 0,
      bi = 0,
      pi = 0
    const rnd = (k) => (Math.sin(k * 12.9898) * 43758.5453) % 1
    bays.forEach(([x, z], b) => {
      for (const dx of [-1.15, 1.15])
        for (const dz of [-0.5, 0.5]) uprights.setMatrixAt(ui++, m4.makeTranslation(x + dx, 2.5, z + dz))
      levels.forEach((y, l) => {
        for (const dz of [-0.5, 0.5]) beams.setMatrixAt(bi++, m4.makeTranslation(x, y + 0.35, z + dz))
        for (const dx of [-0.55, 0.55]) {
          pallets.setMatrixAt(pi, m4.makeTranslation(x + dx, y + 0.46, z))
          const h = 0.55 + Math.abs(rnd(b * 31 + l * 7 + dx)) * 0.5
          cartons.setMatrixAt(
            pi,
            new THREE.Matrix4().compose(
              new THREE.Vector3(x + dx, y + 0.52 + h / 2, z),
              new THREE.Quaternion(),
              new THREE.Vector3(0.9, h, 0.9),
            ),
          )
          pi++
        }
      })
    })
    s.add(uprights, beams, pallets, cartons)
    // 천장 조명 띠(빛나는 막대만, 실제 광원 없음)
    const strips = new THREE.InstancedMesh(
      new THREE.BoxGeometry(6, 0.05, 0.18),
      new THREE.MeshBasicMaterial({ color: '#9fdcff' }),
      12,
    )
    let si = 0
    for (const x of [-9, -2, 5, 12])
      for (const z of [-3.2, 2.6, 8.4]) strips.setMatrixAt(si++, m4.makeTranslation(x, 6.4, z))
    s.add(strips)
  }

  _resize() {
    const { clientWidth: w, clientHeight: h } = this.el
    this.renderer.setSize(w, h)
    this.camera.aspect = w / Math.max(h, 1)
    this.camera.updateProjectionMatrix()
  }

  /** boxesPerLine: 라인마다 진열할 박스 목록(null 이면 그 라인은 멈춰 둔다), isNew: 신규 규격 코드 집합 */
  reset(truckMm, boxesPerLine, isNew = new Set()) {
    for (const f of this.flights) f.obj.parent?.remove(f.obj)
    this.flights = []
    this.selectables = []
    this.truckMm = truckMm
    const codes = [
      ...new Map(
        boxesPerLine
          .flat()
          .filter(Boolean)
          .map((b) => [b.code, b]),
      ).keys(),
    ]
    this.codeColor = Object.fromEntries(codes.map((c, i) => [c, CODE_COLORS[i % CODE_COLORS.length]]))
    this.isNew = isNew
    this.compare = !!boxesPerLine[1] // 두 라인을 같이 돌리면 트럭 이름에 라인을 붙인다
    this.lines.forEach((line, i) => line.reset(boxesPerLine[i] ?? null))
  }

  boxColor(ev) {
    return this.colorMode === 'fill' ? fillColor(ev.box.fill) : (this.codeColor[ev.box.code] ?? '#999')
  }

  setColorMode(mode) {
    this.colorMode = mode
    for (const line of this.lines) for (const p of line.packed) setBoxColor(p.group, this.boxColor(p.event))
  }

  /** 결과로 건너뛰기: bulk 동안은 진열대 라벨을 다시 그리지 않고, 끝나면 재고 숫자를 한 번에 맞춘다 */
  beginBulk() {
    this.bulk = true
  }

  endBulk() {
    this.bulk = false
    for (const line of this.lines) line.refreshRack()
  }

  /** 날아가는 물품·트럭을 모두 끝 위치로 보낸다(결과로 건너뛰기 전에) */
  finishAll() {
    for (const f of this.flights) {
      if (f.done) continue
      if (f.kind === 'move') {
        f.obj.position.copy(f.to)
        f.done = true
      } else f.line._advance(f, 1)
    }
    this.flights = this.flights.filter((f) => !f.done)
  }

  /** line 을 주면 그 라인만, 없으면 전체에서 움직이는 것이 있는지 */
  busy(line) {
    return this.flights.some((f) => !f.done && (!line || f.line === line))
  }

  /** 라이브에서는 현재 트럭과 최근 완료 트럭만 남기고, 개별 자원·선택 참조도 함께 정리한다. */
  pruneTrucks(line, keep = 4) {
    if (this.busy(line) || line.trucks.length <= keep) return
    const expired = line.trucks.splice(0, line.trucks.length - keep)
    const removed = new Set()
    for (const truck of expired) truck.group.traverse((node) => removed.add(node))
    this.selectables = this.selectables.filter((node) => !removed.has(node))
    line.packed = line.packed.filter((packed) => !removed.has(packed.group))
    const shared = new Set([...shellGeo.values()].flatMap(({ geo, edges }) => [geo, edges]))
    const disposed = new Set()
    for (const node of removed) {
      // 상자 형상·물품 재질·Sprite 형상은 남은 트럭과 공유하므로 트럭별로 해제하지 않는다.
      if (node.geometry && !node.isSprite && !shared.has(node.geometry) && !disposed.has(node.geometry)) {
        disposed.add(node.geometry)
        node.geometry.dispose()
      }
      for (const material of [].concat(node.material ?? [])) {
        if (material === itemMat || disposed.has(material)) continue
        disposed.add(material)
        material.map?.dispose()
        material.dispose()
      }
    }
    for (const truck of expired) line.group.remove(truck.group)
    line.trucks.slice(0, -1).forEach((truck, i) => truck.group.position.copy(line._parkSlot(i)))
  }

  /** 장면을 유지한 채 진열대 재고 숫자만 서버 값으로 맞춘다(라이브의 입고·실사 snapshot). */
  setRackStock(stockByCode) {
    for (const line of this.lines)
      for (const [code, it] of Object.entries(line.rack?.items ?? {})) {
        if (!(code in stockByCode)) continue
        it.stock = stockByCode[code]
        line._relabel(code, it)
      }
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
        f.line._advance(f, p)
      }
    }
    this.flights = this.flights.filter((f) => !f.done)
    for (const line of this.lines)
      line.tick(
        dt,
        this.flights.some((f) => f.kind === 'item' && f.line === line),
      )
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
    if (truck) this.onSelect({ type: 'truck', no: truck.object.userData.truckNo, lane: truck.object.userData.lane })
  }
}

/** 작업 라인 한 줄: 입고 → DL 측정 → 박스 선택·포장(로봇·진열대) → 트럭. 모든 좌표는 라인 그룹 안(z=0 이 벨트 가운데) */
class Line {
  constructor(world, z, { index, name, title, parkDir }) {
    this.world = world
    this.index = index
    this.name = name
    this.parkDir = parkDir // 출발한 트럭이 서는 방향(-1 뒤쪽, 1 앞쪽)
    this.group = new THREE.Group()
    this.group.position.z = z
    world.scene.add(this.group)
    this.trucks = []
    this.packed = []
    this.binCount = 0
    this.rack = null
    this.gateReadout = null
    this._build(title)
  }

  _build(title) {
    const s = this.group
    const glowLight = new THREE.PointLight('#33c3ff', 6, 7, 2) // 포장대 주변 하늘색 조명
    glowLight.position.set(STATION_X, 2.2, -0.8)
    s.add(glowLight)
    const neon = new THREE.MeshBasicMaterial({ color: '#33c3ff' })
    for (const z of [-1.15, 1.15]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 0.04), neon)
      line.rotation.x = -Math.PI / 2
      line.position.set(-3.9, 0.004, z)
      s.add(line)
    }
    const dock = new THREE.Mesh(
      new THREE.PlaneGeometry(4.8, 3.2),
      new THREE.MeshBasicMaterial({ color: '#0e3a66', transparent: true, opacity: 0.45 }),
    )
    dock.rotation.x = -Math.PI / 2
    dock.position.set(DOOR_X + 2.2, 0.004, 0)
    s.add(dock)

    const metal = new THREE.MeshStandardMaterial({ color: '#8fa3bd', metalness: 0.75, roughness: 0.3 })
    const dark = new THREE.MeshStandardMaterial({ color: '#141f33', metalness: 0.5, roughness: 0.4 })
    const strip = new THREE.MeshBasicMaterial({ color: '#33c3ff' })

    // 컨베이어: 흐르는 벨트(텍스처만 움직임) + 레일의 빛 띠 + 롤러·다리(인스턴스). 포장대 앞에서 끝난다
    const beltStart = START_X - 0.2
    const beltEnd = STATION_X - 0.62
    const len = beltEnd - beltStart
    const cx = (beltStart + beltEnd) / 2
    const c = document.createElement('canvas')
    c.width = 64
    c.height = 64
    const g2 = c.getContext('2d')
    g2.fillStyle = '#121a28'
    g2.fillRect(0, 0, 64, 64)
    g2.fillStyle = '#1d6fa8'
    g2.fillRect(0, 0, 4, 64)
    this.beltTex = new THREE.CanvasTexture(c)
    this.beltTex.wrapS = this.beltTex.wrapT = THREE.RepeatWrapping
    this.beltTex.repeat.set(len * 6, 1)
    const belt = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.04, 0.7),
      new THREE.MeshStandardMaterial({ map: this.beltTex, roughness: 0.7 }),
    )
    belt.position.set(cx, BELT_Y - 0.02, 0)
    belt.receiveShadow = true
    s.add(belt)
    for (const z of [-0.39, 0.39]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.09, 0.05), metal)
      rail.position.set(cx, BELT_Y, z)
      rail.castShadow = true
      const led = new THREE.Mesh(new THREE.BoxGeometry(len, 0.012, 0.052), strip)
      led.position.set(cx, BELT_Y + 0.03, z)
      s.add(rail, led)
    }
    const frameBar = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.82), dark)
    frameBar.position.set(cx, BELT_Y - 0.09, 0)
    s.add(frameBar)
    const rollerGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.7, 10)
    rollerGeo.rotateX(Math.PI / 2)
    const nRoll = Math.floor(len / 0.25)
    const rollers = new THREE.InstancedMesh(rollerGeo, metal, nRoll)
    const m4 = new THREE.Matrix4()
    for (let i = 0; i < nRoll; i++)
      rollers.setMatrixAt(i, m4.makeTranslation(beltStart + 0.1 + i * 0.25, BELT_Y - 0.06, 0))
    s.add(rollers)
    const legXs = []
    for (let x = beltStart + 0.15; x <= beltEnd - 0.1; x += 1.2) legXs.push(x)
    const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, BELT_Y - 0.13, 0.06), dark, legXs.length * 2)
    legXs.forEach((x, i) =>
      [-0.36, 0.36].forEach((z, k) => legs.setMatrixAt(i * 2 + k, m4.makeTranslation(x, (BELT_Y - 0.13) / 2, z))),
    )
    legs.castShadow = true
    s.add(legs)
    const titleLabel = textSprite(title, { size: 60 })
    titleLabel.position.set(START_X + 0.6, BELT_Y + 1.15, 0)
    s.add(titleLabel)

    // DL 측정 게이트: 프레임 + 빛 테두리 + 카메라 3대 + 스캔 빛
    const gate = new THREE.Group()
    for (const z of [-0.6, 0.6]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.95, 0.12), dark)
      post.position.set(0, 0.975, z)
      post.castShadow = true
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.8, 0.125), strip)
      led.position.set(-0.062, 0.975, z)
      gate.add(post, led)
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.32), dark)
    top.position.y = 1.95
    const topLed = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.32), strip)
    topLed.position.set(-0.081, 1.9, 0)
    gate.add(top, topLed)
    const camMat = new THREE.MeshStandardMaterial({ color: '#0d1626', metalness: 0.6, roughness: 0.25 })
    const lensMat = new THREE.MeshBasicMaterial({ color: '#7fe0ff' })
    for (const [y, z] of [
      [1.85, 0],
      [1.35, -0.55],
      [1.35, 0.55],
    ]) {
      const cam = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.09), camMat)
      cam.position.set(0, y, z)
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.025, 12), lensMat)
      lens.position.set(-0.071, y, z)
      lens.rotation.y = -Math.PI / 2
      gate.add(cam, lens)
    }
    this.scan = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 1.05),
      new THREE.MeshBasicMaterial({
        color: '#33c3ff',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    )
    this.scan.rotation.y = Math.PI / 2
    this.scan.position.y = BELT_Y + 0.5
    gate.add(this.scan)
    gate.position.x = GATE_X
    s.add(gate)
    const gl = textSprite('DL 측정')
    gl.position.set(GATE_X, 2.35, 0)
    s.add(gl)

    // 포장대: 어두운 상판 + 빛 테두리 + 다리
    const station = new THREE.Group()
    const deskMat = new THREE.MeshStandardMaterial({ color: '#1b2a44', metalness: 0.4, roughness: 0.35 })
    const desk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 1.3), deskMat)
    desk.position.y = BELT_Y - 0.03
    desk.castShadow = desk.receiveShadow = true
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(desk.geometry),
      new THREE.LineBasicMaterial({ color: '#33c3ff' }),
    )
    edge.position.copy(desk.position)
    station.add(desk, edge)
    for (const [x, z] of [
      [-0.5, -0.6],
      [0.5, -0.6],
      [-0.5, 0.6],
      [0.5, 0.6],
    ]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, BELT_Y - 0.06, 0.06), dark)
      leg.position.set(x, (BELT_Y - 0.06) / 2, z)
      station.add(leg)
    }
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.03, 1.2), dark)
    shelf.position.y = 0.2
    station.add(shelf)
    station.position.set(STATION_X, 0, 0)
    s.add(station)
    const pl = textSprite('박스 선택·포장')
    pl.position.set(STATION_X, 2.35, 0.3)
    s.add(pl)
    this.robot = this._buildRobot()
    this.robot.group.position.set(STATION_X + 0.32, BELT_Y, -0.42)
    s.add(this.robot.group)

    // 담을 박스가 없는 물품
    const bin = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 0.5, 0.8),
      new THREE.MeshStandardMaterial({
        color: '#ff5a5a',
        emissive: '#5a0000',
        transparent: true,
        opacity: 0.5,
        roughness: 0.4,
      }),
    )
    bin.position.set(STATION_X, 0.25, 1.7)
    s.add(bin)
    const bl = textSprite('맞는 박스 없음', { color: '#ffb3b3', border: 'rgba(255,90,90,0.7)' })
    bl.position.set(STATION_X, 1.0, 1.7)
    s.add(bl)

    // 하역장 안전 기둥(볼라드)
    const bollards = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.9, 12),
      new THREE.MeshStandardMaterial({ color: '#e7b93c', roughness: 0.5 }),
      4,
    )
    ;[
      [0.9, -1.7],
      [0.9, 1.7],
      [7.4, -1.7],
      [7.4, 1.7],
    ].forEach(([x, z], i) => bollards.setMatrixAt(i, m4.makeTranslation(x, 0.45, z)))
    s.add(bollards)
  }

  /** 포장 로봇팔: 받침 → 회전대(좌우) → 어깨·팔꿈치(위아래) → 집게. 포장할 때마다 진열대로 돌아 박스를 집어 온다 */
  _buildRobot() {
    const white = new THREE.MeshStandardMaterial({ color: '#e8eef7', metalness: 0.3, roughness: 0.25 })
    const joint = new THREE.MeshStandardMaterial({ color: '#1b2a44', metalness: 0.6, roughness: 0.3 })
    const glow = new THREE.MeshBasicMaterial({ color: '#33c3ff' })
    const group = new THREE.Group()
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.19, 0.08, 24), joint)
    base.position.y = 0.04
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 8, 32), glow)
    ring.rotation.x = Math.PI / 2
    ring.position.y = 0.085
    group.add(base, ring)
    const turret = new THREE.Group()
    turret.position.y = 0.08
    const tBody = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.18, 20), white)
    tBody.position.y = 0.09
    turret.add(tBody)
    group.add(turret)
    const shoulder = new THREE.Group()
    shoulder.position.y = 0.2
    const sJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 20), joint)
    sJoint.rotation.x = Math.PI / 2
    shoulder.add(sJoint)
    turret.add(shoulder)
    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.48, 0.09), white)
    upper.position.y = 0.24
    shoulder.add(upper)
    const elbow = new THREE.Group()
    elbow.position.y = 0.48
    const eJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.13, 20), joint)
    eJoint.rotation.x = Math.PI / 2
    const eLed = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.006, 6, 24), glow)
    eLed.position.z = 0.066
    elbow.add(eJoint, eLed)
    shoulder.add(elbow)
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 0.07), white)
    fore.position.y = 0.2
    elbow.add(fore)
    const wrist = new THREE.Group()
    wrist.position.y = 0.4
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16), joint)
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), glow)
    lamp.position.y = 0.031
    lamp.rotation.x = -Math.PI / 2
    wrist.add(head, lamp)
    const fingers = []
    for (const sgn of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.05), joint)
      f.position.set(sgn * 0.045, 0.08, 0)
      fingers.push(f)
      wrist.add(f)
    }
    elbow.add(wrist)
    group.traverse((o) => {
      if (o.isMesh) o.castShadow = true
    })
    return { group, turret, shoulder, elbow, wrist, fingers, t: 1, idle: 0 }
  }

  /** 로봇 자세: t 0→1 동안 진열대(뒤쪽)로 돌아 집고 → 포장대로 돌아와 내려놓는다 */
  _animateRobot(dt) {
    const r = this.robot
    r.idle += dt
    const REST = 3.9 // 쉬는 방향: 포장대 가운데를 본다
    let yaw = REST + Math.sin(r.idle * 0.6) * 0.12
    let sh = -0.35 + Math.sin(r.idle * 0.9) * 0.05
    let el = 1.2
    let grip = 0.045
    if (r.t < 1) {
      r.t = Math.min(1, r.t + dt / r.dur)
      const k = r.t
      const ease = (x) => x * x * (3 - 2 * x)
      if (k < 0.35) {
        // 진열대 쪽으로 돌아 팔을 뻗는다
        const q = ease(k / 0.35)
        yaw = THREE.MathUtils.lerp(REST, 2.3, q)
        sh = THREE.MathUtils.lerp(-0.35, -0.95, q)
        el = THREE.MathUtils.lerp(1.2, 0.7, q)
      } else if (k < 0.5) {
        // 집는다
        yaw = 2.3
        sh = -0.95
        el = 0.7
        grip = THREE.MathUtils.lerp(0.045, 0.028, (k - 0.35) / 0.15)
      } else {
        // 포장대로 돌아와 내려놓는다
        const q = ease((k - 0.5) / 0.5)
        yaw = THREE.MathUtils.lerp(2.3, REST, q)
        sh = THREE.MathUtils.lerp(-0.95, -0.55, q)
        el = THREE.MathUtils.lerp(0.7, 1.4, q)
        grip = q > 0.85 ? 0.045 : 0.028
      }
    }
    r.turret.rotation.y = yaw
    r.shoulder.rotation.z = sh
    r.elbow.rotation.z = el
    r.wrist.rotation.z = -(sh + el) * 0.5 // 집게가 대체로 아래를 보게
    r.fingers[0].position.x = -grip
    r.fingers[1].position.x = grip
  }

  _rackLabel(code, stock) {
    const tag = this.world.isNew?.has(code) ? '★ 신규\n' : ''
    return textSprite(`${tag}${code}\n재고 ${stock == null ? '미입력' : stock.toLocaleString('ko-KR')}`, {
      size: 44,
      ...(tag ? { color: '#ffe29a', border: 'rgba(255,209,102,0.9)' } : {}),
    })
  }

  /** 포장대 뒤 진열대: 이 라인이 쓰는 박스를 크기 순으로 세워 두고, 고를 때마다 그 박스가 반짝이며 재고가 줄어든다 */
  _buildRack(boxes) {
    if (this.rack) {
      this.group.remove(this.rack.group)
      this.rack.group.traverse((o) => {
        o.geometry?.dispose()
        ;[].concat(o.material ?? []).forEach((m) => {
          m.map?.dispose()
          m.dispose()
        })
      })
      this.rack = null
    }
    if (!boxes) return
    const group = new THREE.Group()
    const sorted = [...boxes].sort((a, b) => a.dims[0] * a.dims[1] * a.dims[2] - b.dims[0] * b.dims[1] * b.dims[2])
    const gap = 0.18
    const widths = sorted.map((b) => Math.max(...b.dims) * MM)
    const total = widths.reduce((a, w) => a + w, 0) + gap * (sorted.length - 1)
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(total + 0.5, 0.12, 0.8),
      new THREE.MeshStandardMaterial({ color: '#16243b', metalness: 0.5, roughness: 0.35 }),
    )
    const pEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(platform.geometry),
      new THREE.LineBasicMaterial({ color: '#33c3ff' }),
    )
    pEdge.position.set(0, 0.06, 0)
    group.add(pEdge)
    platform.position.set(0, 0.06, 0)
    platform.receiveShadow = true
    group.add(platform)
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(total + 0.5, 1.1, 0.04),
      new THREE.MeshStandardMaterial({ color: '#0e2a4d', transparent: true, opacity: 0.55, emissive: '#06213f' }),
    )
    back.position.set(0, 0.67, -0.38)
    group.add(back)
    const items = {}
    let x = -total / 2
    sorted.forEach((b, i) => {
      const [w, d, h] = [...b.dims].sort((p, q) => q - p) // 넓은 면이 앞으로
      const color = this.world.codeColor[b.code]
      const fresh = this.world.isNew?.has(b.code)
      const geo = new THREE.BoxGeometry(w * MM, h * MM, d * MM)
      const mat = new THREE.MeshStandardMaterial({
        color: '#c8a26b',
        roughness: 0.85,
        emissive: color,
        emissiveIntensity: fresh ? 0.35 : 0,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.castShadow = true
      const cx = x + widths[i] / 2
      mesh.position.set(cx, 0.12 + (h * MM) / 2, 0)
      const tape = new THREE.Mesh(
        new THREE.BoxGeometry(w * MM + 0.002, 0.012, 0.05),
        new THREE.MeshStandardMaterial({ color }),
      )
      tape.position.set(cx, 0.12 + h * MM + 0.004, 0)
      group.add(mesh, tape)
      const label = this._rackLabel(b.code, b.stock)
      label.position.set(cx, 0.12 + h * MM + 0.3, 0)
      group.add(label)
      items[b.code] = { mesh, label, labelY: label.position.y, x: cx, glow: 0, base: fresh ? 0.35 : 0 }
      x += widths[i] + gap
    })
    const title = textSprite('보유 박스 (크기 순)', { size: 52 })
    title.position.set(0, 1.55, -0.3)
    group.add(title)
    group.position.set(STATION_X - 0.4, 0, -2.0)
    this.group.add(group)
    this.rack = { group, items }
  }

  /** 진열대에서 고른 박스를 반짝이고 재고 숫자를 바꾼다 */
  _pickFromRack(code, stockAfter, duration = 0.9) {
    this.robot.t = 0
    this.robot.dur = Math.max(0.35, Math.min(1.2, duration))
    const it = this.rack?.items[code]
    if (!it) return
    it.stock = stockAfter
    if (this.world.bulk) return // 결과로 건너뛰는 중: 라벨은 끝에 한 번만
    it.glow = 1
    this._relabel(code, it)
  }

  _relabel(code, it) {
    this.rack.group.remove(it.label)
    it.label.material.map.dispose()
    it.label.material.dispose()
    it.label = this._rackLabel(code, it.stock)
    it.label.position.set(it.x, it.labelY, 0)
    this.rack.group.add(it.label)
  }

  refreshRack() {
    for (const [code, it] of Object.entries(this.rack?.items ?? {})) if (it.stock != null) this._relabel(code, it)
  }

  reset(boxes) {
    for (const t of this.trucks) this.group.remove(t.group)
    if (this.gateReadout) {
      this.group.remove(this.gateReadout)
      this.gateReadout = null
    }
    this.trucks = []
    this.packed = []
    this.binCount = 0
    this.active = !!boxes
    this._buildRack(boxes)
    this.group.visible = !!boxes // 쓰지 않는 라인(기본 시뮬레이션의 제안 라인)은 숨긴다
    if (boxes) this._newTruck(1, true)
  }

  _truckGroup(no) {
    const [L, W, H] = this.world.truckMm.map((v) => v * MM)
    const g = new THREE.Group()
    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(L, H, W),
      new THREE.MeshStandardMaterial({
        color: '#3fa9ff',
        emissive: '#08264a',
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    cargo.position.set(L / 2, TRUCK_FLOOR + H / 2, 0)
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(cargo.geometry),
      new THREE.LineBasicMaterial({ color: '#4cc9ff' }),
    )
    frame.position.copy(cargo.position)
    const bed = new THREE.Mesh(
      new THREE.BoxGeometry(L + 1.6, 0.15, W + 0.1),
      new THREE.MeshStandardMaterial({ color: '#141f33', metalness: 0.5, roughness: 0.4 }),
    )
    bed.position.set(L / 2 + 0.8, TRUCK_FLOOR - 0.08, 0)
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 1.5, W + 0.1),
      new THREE.MeshStandardMaterial({ color: '#dfe8f5', metalness: 0.3, roughness: 0.25 }),
    )
    cab.position.set(L + 0.85, TRUCK_FLOOR + 0.75, 0)
    g.add(cargo, frame, bed, cab)
    for (const x of [0.6, L + 0.9]) {
      for (const z of [-W / 2, W / 2]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.38, 0.38, 0.25, 20),
          new THREE.MeshStandardMaterial({ color: '#0b0f17', roughness: 0.6 }),
        )
        wheel.rotation.x = Math.PI / 2
        wheel.position.set(x, 0.38, z)
        g.add(wheel)
      }
    }
    const label = textSprite(
      `${this.world.compare ? `${this.name} ` : ''}트럭 ${no}`,
      this.index ? { color: '#ffe29a', border: 'rgba(255,209,102,0.8)' } : {},
    )
    label.position.set(L / 2, TRUCK_FLOOR + H + 0.45, 0)
    g.add(label)
    cargo.userData.truckNo = no
    cargo.userData.lane = this.index
    this.world.selectables.push(cargo)
    return g
  }

  _newTruck(no, instant = false) {
    const g = this._truckGroup(no)
    g.position.set(instant ? DOOR_X : DOOR_X + 12, 0, 0)
    this.group.add(g)
    const t = { no, group: g, boxes: [], target: new THREE.Vector3(DOOR_X, 0, 0) }
    this.trucks.push(t)
    if (!instant)
      this.world.flights.push({
        line: this,
        obj: g,
        kind: 'move',
        from: g.position.clone(),
        to: t.target.clone(),
        t: 0,
        dur: 1.2,
      })
    return t
  }

  current() {
    return this.trucks[this.trucks.length - 1]
  }

  /** 꽉 찬 트럭은 출발해 옆 줄에 서고(누적), 새 트럭이 들어온다 */
  swapTruck(no, duration) {
    const old = this.current()
    const to = this._parkSlot(this.trucks.length - 1)
    if (duration === 0) {
      // 결과로 건너뛰기: 애니메이션 없이 바로
      old.group.position.copy(to)
      return this._newTruck(no, true)
    }
    this.world.flights.push({
      line: this,
      obj: old.group,
      kind: 'move',
      from: old.group.position.clone(),
      to,
      t: 0,
      dur: duration,
    })
    const t = this._newTruck(no)
    this.world.flights[this.world.flights.length - 1].dur = duration
    return t
  }

  /** 출발한 트럭이 설 자리: 라인 바깥쪽 3×3 칸. 칸이 다 차면 그 칸에 있던 가장 오래된 트럭을 화면에서 내린다(기록은 남음) */
  _parkSlot(parkedIndex) {
    const COLS = 3
    const ROWS = 3
    const slot = parkedIndex % (COLS * ROWS)
    const col = slot % COLS
    const row = Math.floor(slot / COLS)
    const older = this.trucks[parkedIndex - COLS * ROWS]
    if (older) {
      older.group.visible = false
      this.world.selectables = this.world.selectables.filter((o) => {
        let p = o
        while (p) {
          if (p === older.group) return false
          p = p.parent
        }
        return true
      })
    }
    return new THREE.Vector3(DOOR_X + 0.6 + col * 5.0, 0, this.parkDir * (PARK_Z + row * 2.4))
  }

  /** 물품 한 건을 컨베이어 → 측정 → 포장 → 트럭으로 흘린다. duration: 전체 걸리는 시간(초), 0이면 바로 적재 */
  push(ev, duration) {
    const item = new THREE.Mesh(
      new THREE.BoxGeometry(...[ev.item.dims[0], ev.item.dims[2], ev.item.dims[1]].map((v) => v * MM)),
      new THREE.MeshStandardMaterial({ color: '#c9b79c', roughness: 0.8 }),
    )
    item.castShadow = true
    const h = ev.item.dims[2] * MM
    item.position.set(START_X, BELT_Y + h / 2, 0)
    this.group.add(item)
    const f = {
      line: this,
      obj: item,
      kind: 'item',
      ev,
      t: 0,
      dur: Math.max(duration, 0.0001),
      h,
      scanned: false,
      packed: false,
    }
    this.world.flights.push(f)
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
      f.obj.position.x = GATE_X + (STATION_X - GATE_X) * ((p - 0.55) / 0.2)
    } else if (!ev.box) {
      if (!f.packed) {
        f.packed = true
        f.from = f.obj.position.clone()
        this.binCount += 1
      }
      const q = (p - 0.75) / 0.25
      f.obj.position.lerpVectors(f.from, new THREE.Vector3(STATION_X, 0.55 + (this.binCount % 5) * 0.05, 1.7), q)
    } else {
      if (!f.packed) {
        f.packed = true
        this.group.remove(f.obj)
        f.obj.geometry.dispose()
        f.obj.material.dispose()
        this._pickFromRack(ev.box.code, ev.box.stockAfter, f.dur * 0.25)
        const g = makePackedBox(ev.box.size, ev.item.dims, this.world.boxColor(ev))
        g.position.set(STATION_X, BELT_Y + (ev.box.size[2] * MM) / 2, 0)
        this.group.add(g)
        f.obj = g
        f.from = g.position.clone()
        f.truck = this.current()
        const [L, W] = this.world.truckMm
        const [px, py, pz] = ev.box.pos
        const [sx, sy, sz] = ev.box.size
        // 트럭 좌표 x=0 이 운전석 쪽(안쪽). 문은 DOOR_X 쪽
        f.local = new THREE.Vector3(
          (L - px - sx / 2) * MM,
          TRUCK_FLOOR + (pz + sz / 2) * MM,
          (py + sy / 2 - W / 2) * MM,
        )
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
    this.world.selectables.push(f.obj.userData.shell)
    this.packed.push({ group: f.obj, event: ev })
    f.truck.boxes.push(ev)
  }

  _readout(text) {
    if (this.world.bulk) return
    if (this.gateReadout) {
      this.group.remove(this.gateReadout)
      this.gateReadout.material.map.dispose()
      this.gateReadout.material.dispose()
    }
    this.gateReadout = textSprite(text, { size: 48 })
    this.gateReadout.position.set(GATE_X, 2.85, 0)
    this.group.add(this.gateReadout)
  }

  tick(dt, flowing) {
    this.scan.material.opacity = Math.max(0, this.scan.material.opacity - dt * 1.5)
    if (flowing) this.beltTex.offset.x -= dt * 1.2 // 물품이 흐를 때만 벨트가 움직인다
    this._animateRobot(dt)
    if (!this.rack) return
    for (const it of Object.values(this.rack.items)) {
      if (it.glow <= 0) continue
      it.glow = Math.max(0, it.glow - dt * 1.4)
      it.mesh.material.emissiveIntensity = Math.max(it.base, it.glow * 0.9)
    }
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
