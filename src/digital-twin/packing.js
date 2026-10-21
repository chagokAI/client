// 박스 선택과 트럭 적재 계산 — 서버 FillRateCalculator 와 같은 규칙
// - 들어가는지: 물품 세 변과 박스 세 변을 각각 정렬해 모두 작거나 같으면 들어간다(90도 회전, 여유 0mm)
// - 충전율: 물품 부피 ÷ 박스 내부 부피 × 100, 소수 둘째 자리 반올림
// - 고르는 박스: 재고가 남은 박스 중 들어가는 박스에서 충전율이 가장 높은 것
// - 트럭: 적재함 안쪽(운전석 쪽) → 바닥 → 왼쪽 순 첫 빈자리, 아래 상자가 70% 이상 받쳐야 위에 쌓는다

export const TRUCK_MM = [2800, 1600, 1600] // 1톤 탑차 적재함(길이, 폭, 높이)

const asc = (d) => [...d].sort((a, b) => a - b)
export const vol = (d) => d[0] * d[1] * d[2]

export function fits(item, box) {
  const i = asc(item)
  const b = asc(box)
  return i.every((v, k) => v <= b[k])
}

export function fillRate(item, box) {
  return Math.round((10000 * vol(item)) / vol(box)) / 100
}

/** 박스마다 판정 이유를 남기고 1순위를 고른다. 반환: { best, candidates } */
export function evaluate(item, boxes, stock) {
  const cands = boxes.map((b) => {
    const ok = fits(item, b.dims)
    const left = stock[b.code] ?? 0
    let reason
    if (!ok) {
      const over = Math.max(...asc(item).map((v, k) => v - asc(b.dims)[k]))
      reason = `안 들어감 (가장 큰 초과 ${over}mm)`
    } else reason = left > 0 ? '들어감' : '들어가지만 재고 없음'
    return { code: b.code, dims: b.dims, fits: ok, stock: left, fill: ok ? fillRate(item, b.dims) : null, reason }
  })
  const usable = cands.filter((c) => c.fits && c.stock > 0)
  const best = usable.reduce((a, c) => (!a || c.fill > a.fill ? c : a), null)
  for (const c of cands) {
    if (best && c.code === best.code) c.reason = `선택 — 들어가는 박스 중 충전율 최고(${c.fill}%)`
    else if (best && c.fits && c.stock > 0) c.reason = `들어가지만 충전율 ${c.fill}% < ${best.fill}%`
  }
  cands.sort((a, b) => (a.fits === b.fits ? (b.fill ?? 0) - (a.fill ?? 0) : a.fits ? -1 : 1))
  return { best, candidates: cands }
}

export class Truck {
  constructor(no, size = TRUCK_MM) {
    this.no = no
    this.size = size
    this.boxes = []
    this.points = [[0, 0, 0]]
  }

  _free(pos, size) {
    const [x, y, z] = pos
    const [L, W, H] = this.size
    if (x + size[0] > L || y + size[1] > W || z + size[2] > H) return false
    for (const b of this.boxes) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      if (x < bx + sx && bx < x + size[0] && y < by + sy && by < y + size[1] && z < bz + sz && bz < z + size[2]) return false
    }
    if (z === 0) return true
    let support = 0
    for (const b of this.boxes) {
      const [bx, by, bz] = b.pos
      const [sx, sy, sz] = b.size
      if (bz + sz === z) {
        const ox = Math.max(0, Math.min(x + size[0], bx + sx) - Math.max(x, bx))
        const oy = Math.max(0, Math.min(y + size[1], by + sy) - Math.max(y, by))
        support += ox * oy
      }
    }
    return support >= 0.7 * size[0] * size[1]
  }

  /** 들어갈 자리를 찾아 놓는다. 바닥 면적이 넓게 눕힌다(높이는 가장 짧은 변). 없으면 null */
  place(dims) {
    const [a, b, c] = [...dims].sort((p, q) => q - p)
    const orients = [[b, a, c], [a, b, c]]
    const order = [...this.points].sort((p, q) => p[0] - q[0] || p[2] - q[2] || p[1] - q[1])
    for (const pos of order) {
      for (const size of orients) {
        if (this._free(pos, size)) {
          const [x, y, z] = pos
          this.boxes.push({ pos, size })
          this.points = this.points.filter((p) => p !== pos)
          this.points.push([x + size[0], y, z], [x, y + size[1], z], [x, y, z + size[2]])
          return { pos, size }
        }
      }
    }
    return null
  }
}

/**
 * 구간의 출고 이벤트를 시간순으로 흘려 박스를 고르고 트럭에 싣는다(재고는 시뮬레이션 안에서만 줄어든다).
 * observations: /simulation-state 의 items, boxes: [{ code, name, dims, price, stock }]
 */
export function simulate(observations, boxes) {
  const stock = Object.fromEntries(boxes.map((b) => [b.code, b.stock]))
  const trucks = [new Truck(1)]
  const events = []
  const skipped = { noDims: 0, noBox: 0 }
  for (const o of observations) {
    const m = o.measurement
    const p = o.product
    let dims
    let source
    if (m && m.widthMm) {
      dims = [m.widthMm, m.depthMm, m.heightMm]
      source = m.sizeType === 'measured' ? 'DL 측정' : 'DL 추정(처음 보는 물품)'
    } else if (p?.dimensions?.widthMm) {
      dims = [p.dimensions.widthMm, p.dimensions.depthMm, p.dimensions.heightMm]
      source = '라벨 치수(DL 측정 없음)'
    } else {
      skipped.noDims += 1
      continue
    }
    const { best, candidates } = evaluate(dims, boxes, stock)
    const ev = {
      eventId: o.eventId, at: o.observedAt, status: o.status, candidates,
      item: { name: p?.name ?? '처음 보는 물품', code: p?.code, productId: p?.id, dims, source,
        dl: m ? { status: m.dlStatus, sizeType: m.sizeType, latencyMs: m.latencyMs, failureReason: m.failureReason } : null },
      box: null,
    }
    if (best) {
      stock[best.code] -= 1
      const spec = boxes.find((b) => b.code === best.code)
      let spot = trucks.at(-1).place(spec.dims)
      if (!spot) {
        trucks.push(new Truck(trucks.length + 1))
        spot = trucks.at(-1).place(spec.dims)
      }
      ev.box = { code: spec.code, name: spec.name, dims: spec.dims, price: spec.price, fill: best.fill,
        emptyCm3: Math.round((vol(spec.dims) - vol(dims)) / 100) / 10, stockAfter: stock[spec.code],
        truck: trucks.at(-1).no, pos: spot.pos, size: spot.size }
    } else skipped.noBox += 1
    events.push(ev)
  }
  return { events, trucks: trucks.length, skipped }
}
