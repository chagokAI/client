import { warehouseApi } from '@/stores/auth'
import { World, MiniView, fillColor } from './scene.js'
import { TRUCK_MM, simulate } from './packing.js'


/**
 * 물류공간 디지털트윈 화면을 root 안에 붙인다. 반환값을 부르면 타이머·3D 자원·이벤트를 정리한다.
 * 데이터는 기존 Spring API(로그인 세션)로 받는다: 출고 이벤트·DL 측정 치수 /simulation-state(from·to),
 * 재고 /box-inventories, 단가 /box-specs, 물품 원본 /products/{id}. 박스 선택·트럭 적재는 packing.js 에서 계산한다.
 */
export function mountTwin(root) {
  const $ = (id) => root.querySelector(`#${id}`)
  const n = (v) => (v ?? 0).toLocaleString('ko-KR')
  // 이벤트 시각(UTC ISO) → 한국 시각
  const kstTime = (at) => new Date(at).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  const kstDateTime = (at) => new Date(at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

  const state = {
    sim: null, // { boxes, events, trucks, skipped, returned, truckMm }
    next: 0, // 다음에 흘려보낼 행
    playing: false,
    speed: 2, // 건/초
    done: [], // 처리된 이벤트
    crumbs: [], // 상세 패널 이동 경로
  }
  let mini = null

  const world = new World($('scene'), { onSelect: (sel) => openDetail(sel, 'reset') })

  // ---------------------------------------------------------------- 데이터
  const MAX_EVENTS = 500 // /simulation-state 한 번에 받는 상한

  function init() {
    // 기본 구간: DL 측정이 있는 기간(2026-05 ~ 09)의 마지막 달 첫날 근무 시간
    $('from').value = '2026-09-01T08:00'
    $('to').value = '2026-09-01T20:00'
    $('limit').max = MAX_EVENTS
    $('limit').value = Math.min(Number($('limit').value), MAX_EVENTS)
    status('구간을 정해 불러오세요 · DL 측정 치수는 2026-05 ~ 09 구간에 있어요')
  }

  async function loadBoxes() {
    // 재고(보유 박스·치수)는 /box-inventories, 단가는 /box-specs 에서 가져와 코드로 합친다
    const [inv, specs] = await Promise.all([
      warehouseApi('/box-inventories', { query: { size: 100 } }),
      warehouseApi('/box-specs', { query: { active: true, size: 100 } }),
    ])
    const price = Object.fromEntries((specs.data.items ?? specs.data.content ?? []).map((b) => [b.code, b.unitPriceKrw]))
    return (inv.data.items ?? []).filter((b) => b.innerWidthMm).map((b) => ({
      code: b.boxCode, name: b.boxName, dims: [b.innerWidthMm, b.innerDepthMm, b.innerHeightMm],
      price: price[b.boxCode] ?? null, stock: b.onHandQty ?? 0,
    })).sort((a, b) => a.code.localeCompare(b.code, 'ko'))
  }

  async function load() {
    pause()
    status('불러오는 중…')
    try {
      const limit = Math.min(Number($('limit').value) || 300, MAX_EVENTS)
      const kst = (v) => `${v}:00+09:00`
      const [boxes, scene] = await Promise.all([
        loadBoxes(),
        warehouseApi('/simulation-state', { query: { from: kst($('from').value), to: kst($('to').value), limit } }),
      ])
      const result = simulate(scene.data.items, boxes)
      const sim = { ...result, boxes, truckMm: TRUCK_MM, returned: result.events.length }
      state.sim = sim
      state.next = 0
      state.done = []
      world.reset(sim.truckMm, sim.boxes)
      legend()
      $('log').innerHTML = ''
      renderStats()
      $('play').disabled = $('step').disabled = !sim.events.length
      const full = scene.data.items.length >= limit ? ` (최대 ${limit}건까지, 구간을 줄이면 전부 볼 수 있어요)` : ''
      status(`${n(sim.returned)}건 불러옴${full} · 트럭 ${sim.trucks}대 예정`)
      openDetail({ type: 'home' }, 'reset')
    } catch (e) {
      status(`불러오기 실패: ${e.message}`)
    }
  }

  // ---------------------------------------------------------------- 재생
  let timer = null
  let swapping = false

  function stepDuration() {
    // 한 건이 컨베이어→트럭까지 가는 시간. 빠를수록 짧게, 아주 빠르면 바로 적재
    return state.speed >= 20 ? 0 : Math.max(0.6, Math.min(5, 8 / state.speed))
  }

  function pushOne() {
    const sim = state.sim
    if (!sim || state.next >= sim.events.length || swapping) return false
    const ev = sim.events[state.next]
    const cur = world.current()
    if (ev.box && ev.box.truck !== cur.no) {
      // 꽉 찬 트럭: 실려 가는 상자가 다 내려앉은 뒤 출발
      if (world.busy()) return false
      swapping = true
      const d = stepDuration() === 0 ? 0.3 : 1.5
      world.swapTruck(ev.box.truck, d)
      log(`트럭 ${cur.no} 출발 (${cur.boxes.length}상자) → 트럭 ${ev.box.truck} 진입`, 'truck')
      setTimeout(() => { swapping = false }, d * 1000)
      renderStats()
      return false
    }
    state.next += 1
    world.push(ev, stepDuration())
    state.done.push(ev)
    showNow(ev)
    log(ev.box ? `${kstTime(ev.at)} ${ev.item.name} → ${ev.box.code} (${ev.box.fill}%)`
      : `${kstTime(ev.at)} ${ev.item.name} → 맞는 박스 없음`, ev.box ? '' : 'miss')
    if (state.done.length % 5 === 0 || state.next === sim.events.length) renderStats()
    if (state.next === sim.events.length) {
      status(`끝 · ${n(sim.returned)}건 처리, 트럭 ${sim.trucks}대`)
      pause()
    }
    return true
  }

  function play() {
    if (!state.sim) return
    state.playing = true
    $('play').textContent = '❚❚ 일시정지'
    const tick = () => {
      if (!state.playing) return
      pushOne()
      timer = setTimeout(tick, 1000 / state.speed)
    }
    tick()
  }

  function pause() {
    state.playing = false
    clearTimeout(timer)
    $('play').textContent = '▶ 재생'
  }

  // ---------------------------------------------------------------- 화면 조각
  function status(t) { $('status').textContent = t }

  function log(text, cls) {
    const li = document.createElement('li')
    li.textContent = text
    if (cls) li.className = cls
    $('log').prepend(li)
    while ($('log').children.length > 200) $('log').lastChild.remove()
  }

  function showNow(ev) {
    $('now').innerHTML = `<b>${esc(ev.item.name)}</b> · ${ev.item.dims.join('×')}mm <span class="tag">${esc(ev.item.source)}</span><br>` +
      (ev.box ? `→ <b>${esc(ev.box.code)}</b> ${ev.box.dims.join('×')}mm · 충전율 <b>${ev.box.fill}%</b> · 빈 공간 ${n(ev.box.emptyCm3)}cm³ · 트럭 ${ev.box.truck}`
        : '→ 보유 박스 어디에도 들어가지 않음')
  }

  function legend() {
    const el = $('legend')
    if (world.colorMode === 'fill') {
      el.innerHTML = [10, 30, 50, 70].map((v) => `<span><i style="background:#${fillColor(v).getHexString()}"></i>${v}%</span>`).join('') +
        '<span>충전율 낮음 → 높음</span>'
    } else {
      el.innerHTML = state.sim.boxes.map((b) => `<span><i style="background:${world.codeColor[b.code]}"></i>${esc(b.code)}</span>`).join('')
    }
  }

  function boxStatsNow() {
    // 지금까지 흘린 것 기준 호수별 사용·평균 충전율·남은 재고
    const sim = state.sim
    return sim.boxes.map((b) => {
      const evs = state.done.filter((e) => e.box && e.box.code === b.code)
      const avg = evs.length ? evs.reduce((s, e) => s + e.box.fill, 0) / evs.length : null
      return { ...b, used: evs.length, avgFill: avg, stockNow: b.stock - evs.length }
    })
  }

  function renderStats() {
    if (!state.sim) return
    $('boxStats').innerHTML = '<table><tr><th>호수</th><th class="num">사용</th><th class="num">평균 충전율</th><th class="num">재고</th></tr>' +
      boxStatsNow().map((s) => `<tr><td><button class="link" data-code="${esc(s.code)}">${esc(s.code)}</button></td>` +
        `<td class="num">${n(s.used)}</td><td class="num">${s.avgFill == null ? '—' : s.avgFill.toFixed(1) + '%'}</td>` +
        `<td class="num">${n(s.stockNow)}</td></tr>`).join('') + '</table>'
    const trucks = world.trucks.map((t) => {
      const vol = t.boxes.reduce((s, e) => s + e.box.size[0] * e.box.size[1] * e.box.size[2], 0)
      const cap = state.sim.truckMm.reduce((a, b) => a * b, 1)
      return { no: t.no, boxes: t.boxes.length, load: (100 * vol) / cap }
    })
    $('trucks').innerHTML = trucks.map((t) => `<div><button class="link" data-truck="${t.no}">트럭 ${t.no}</button> · ${t.boxes}상자 · 적재율 ${t.load.toFixed(1)}%` +
      `<div class="bar-fill"><i style="width:${t.load}%;background:#603c22"></i></div></div>`).join('')
  }

  // ---------------------------------------------------------------- 상세 패널 (상자 → 물품 원본 → 호수 통계 → 트럭)
  function crumbLabel(c) {
    return { home: '처음', box: `상자 ${c.event?.box?.code ?? ''}`, item: '물품 원본', code: `${c.code} 통계`, truck: `트럭 ${c.no}` }[c.type]
  }

  // mode: 'reset'(새로 시작) · 'push'(따라 들어가기) · 'keep'(경로 그대로, 경로 버튼으로 되돌아갈 때)
  function openDetail(sel, mode = 'push') {
    if (mode === 'reset') state.crumbs = [sel]
    else if (mode === 'push') state.crumbs.push(sel)
    renderCrumbs()
    const d = $('detail')
    if (mini) { mini.dispose(); mini = null }
    if (sel.type === 'home') {
      d.innerHTML = '<p class="hint">트럭 안의 상자를 누르면 미니 3D, 충전율, 빈 공간, 왜 이 상자인지 볼 수 있어요.<br>' +
        '아래 호수·트럭 이름을 눌러도 됩니다.</p>'
    } else if (sel.type === 'box') {
      d.innerHTML = boxView(sel.event)
      mini = new MiniView(d.querySelector('.mini'))
      mini.show(sel.event, world.boxColor(sel.event))
    } else if (sel.type === 'item') {
      d.innerHTML = itemView(sel.event)
    } else if (sel.type === 'code') {
      d.innerHTML = codeView(sel.code)
    } else if (sel.type === 'truck') {
      d.innerHTML = truckView(sel.no)
    }
  }

  function renderCrumbs() {
    $('crumbs').innerHTML = state.crumbs.map((c, i) =>
      `<button data-crumb="${i}" class="${i === state.crumbs.length - 1 ? 'on' : ''}">${esc(crumbLabel(c))}</button>`).join('<span>›</span>')
  }

  function boxView(ev) {
    const b = ev.box
    const rows = ev.candidates.map((c) => `<tr class="${c.code === b.code ? 'pick' : c.fits ? '' : 'no'}">` +
      `<td>${esc(c.code)}</td><td>${c.dims.join('×')}</td><td class="num">${c.fill == null ? '—' : c.fill + '%'}</td>` +
      `<td class="num">${n(c.stock)}</td><td>${esc(c.reason)}</td></tr>`).join('')
    return `<h2>${esc(b.code)} <small>${esc(b.name ?? '')}</small></h2>
      <div class="mini"></div>
      <dl class="kv">
        <dt>충전율</dt><dd><b>${b.fill}%</b></dd>
        <dt>빈 공간</dt><dd>${n(b.emptyCm3)} cm³ (상자 ${n(Math.round(b.dims.reduce((a, c) => a * c, 1) / 1000))} cm³)</dd>
        <dt>상자 내치수</dt><dd>${b.dims.join(' × ')} mm · ${n(b.price)}원</dd>
        <dt>물품</dt><dd><button class="link" data-goto="item">${esc(ev.item.name)}</button> · ${ev.item.dims.join(' × ')} mm</dd>
        <dt>트럭</dt><dd><button class="link" data-goto="truck">트럭 ${b.truck}</button> · 위치 ${b.pos.join(', ')} mm</dd>
        <dt>처리 시각</dt><dd>${esc(kstDateTime(ev.at))}</dd>
      </dl>
      <h3>왜 이 상자인가</h3>
      <p class="hint">재고가 남은 박스 중 물품이 들어가는 박스에서 충전율이 가장 높은 박스를 고릅니다 (서버 매칭과 같은 계산).</p>
      <table><tr><th>호수</th><th>내치수</th><th class="num">충전율</th><th class="num">재고</th><th>판정</th></tr>${rows}</table>
      <p><button class="link" data-goto="code" data-code="${esc(b.code)}">${esc(b.code)} 호수 통계 보기 →</button></p>`
  }

  function itemView(ev) {
    const it = ev.item
    const dl = it.dl
    if (it.productId) loadProduct(it.productId)
    return `<h2>${esc(it.name)}</h2>
      <dl class="kv">
        <dt>분류</dt><dd data-product="category">—</dd>
        <dt>바코드</dt><dd data-product="barcode">—</dd>
        <dt>상품 코드</dt><dd>${esc(it.code ?? '—')}</dd>
        <dt>무게</dt><dd data-product="weight">—</dd>
        <dt>라벨 치수</dt><dd data-product="label">—</dd>
        <dt>측정 치수</dt><dd>${it.dims.join(' × ')} mm · 부피 ${n(Math.round(it.dims.reduce((a, c) => a * c, 1) / 1000))} cm³</dd>
        <dt>치수 출처</dt><dd><span class="tag">${esc(it.source)}</span></dd>
        ${dl ? `<dt>DL 판정</dt><dd>${dl.status === 'known' ? '등록 물품' : '처음 보는 물품'} · ${esc(dl.sizeType)} · ${n(dl.latencyMs)} ms${dl.failureReason ? ` · ${esc(dl.failureReason)}` : ''}</dd>` : ''}
        <dt>이벤트</dt><dd>${esc(ev.eventId)} · ${esc(ev.status)}</dd>
      </dl>
      ${ev.box ? `<p><button class="link" data-goto="code" data-code="${esc(ev.box.code)}">담긴 상자 ${esc(ev.box.code)} 통계 보기 →</button></p>` : ''}`
  }

  // 물품 원본은 기존 상품 상세 API(/products/{id})로 채운다
  async function loadProduct(id) {
    try {
      const { data: p } = await warehouseApi(`/products/${id}`)
      const set = (k, v) => { const el = root.querySelector(`[data-product="${k}"]`); if (el) el.textContent = v }
      set('category', p.category?.name ?? '—')
      set('barcode', p.barcode ?? '—')
      set('weight', p.weightG ? `${n(p.weightG)} g` : '—')
      set('label', p.widthMm ? `${p.widthMm} × ${p.depthMm} × ${p.heightMm} mm` : '—')
    } catch { /* 상품 상세를 못 불러와도 측정값은 보여 준다 */ }
  }

  function codeView(code) {
    const s = boxStatsNow().find((x) => x.code === code)
    const evs = state.done.filter((e) => e.box && e.box.code === code)
    const fills = evs.map((e) => e.box.fill)
    const buckets = [0, 20, 40, 60, 80].map((lo) => fills.filter((f) => f >= lo && f < lo + 20).length)
    const max = Math.max(1, ...buckets)
    const trucks = [...new Set(evs.map((e) => e.box.truck))]
    return `<h2>${esc(code)} 호수 통계</h2>
      <dl class="kv">
        <dt>내치수</dt><dd>${s.dims.join(' × ')} mm · ${n(s.price)}원</dd>
        <dt>사용</dt><dd>${n(s.used)}개 (지금까지 흘린 ${n(state.done.length)}건 중)</dd>
        <dt>평균 충전율</dt><dd>${s.avgFill == null ? '—' : s.avgFill.toFixed(1) + '%'}</dd>
        <dt>재고</dt><dd>시작 ${n(s.stock)} → 지금 ${n(s.stockNow)}</dd>
      </dl>
      <h3>충전율 분포</h3>
      ${buckets.map((c, i) => `<div>${i * 20}~${i * 20 + 20}% · ${c}개<div class="bar-fill"><i style="width:${(100 * c) / max}%;background:#${fillColor(i * 20 + 10).getHexString()}"></i></div></div>`).join('')}
      <h3>담긴 물품 (최근 10)</h3>
      <ul>${evs.slice(-10).reverse().map((e) => `<li><button class="link" data-event="${esc(e.eventId)}">${esc(e.item.name)}</button> ${e.box.fill}%</li>`).join('') || '<li>없음</li>'}</ul>
      <h3>실린 트럭</h3>
      <p>${trucks.map((t) => `<button class="link" data-goto="truck" data-no="${t}">트럭 ${t}</button>`).join(' · ') || '—'}</p>`
  }

  function truckView(no) {
    const t = world.trucks.find((x) => x.no === no)
    if (!t) return '<p>아직 없는 트럭이에요.</p>'
    const cap = state.sim.truckMm.reduce((a, b) => a * b, 1)
    const vol = t.boxes.reduce((s, e) => s + e.box.size[0] * e.box.size[1] * e.box.size[2], 0)
    const itemVol = t.boxes.reduce((s, e) => s + e.item.dims[0] * e.item.dims[1] * e.item.dims[2], 0)
    const byCode = {}
    t.boxes.forEach((e) => { byCode[e.box.code] = (byCode[e.box.code] ?? 0) + 1 })
    return `<h2>트럭 ${no}</h2>
      <dl class="kv">
        <dt>적재함</dt><dd>${state.sim.truckMm.join(' × ')} mm</dd>
        <dt>상자</dt><dd>${n(t.boxes.length)}개</dd>
        <dt>상자 적재율</dt><dd>${((100 * vol) / cap).toFixed(1)}% (상자 부피 / 적재함)</dd>
        <dt>물품 적재율</dt><dd>${((100 * itemVol) / cap).toFixed(1)}% (물품 부피 / 적재함)</dd>
        <dt>상태</dt><dd>${t === world.current() ? '싣는 중' : '출발함'}</dd>
      </dl>
      <h3>호수별</h3>
      <p>${Object.entries(byCode).map(([c, k]) => `<button class="link" data-goto="code" data-code="${esc(c)}">${esc(c)}</button> ${k}개`).join(' · ') || '—'}</p>
      <h3>실린 상자 (최근 10)</h3>
      <ul>${t.boxes.slice(-10).reverse().map((e) => `<li><button class="link" data-event="${esc(e.eventId)}">${esc(e.box.code)} · ${esc(e.item.name)}</button> ${e.box.fill}%</li>`).join('') || '<li>없음</li>'}</ul>`
  }

  // ---------------------------------------------------------------- 이벤트 연결
  $('load').addEventListener('click', load)
  $('play').addEventListener('click', () => (state.playing ? pause() : play()))
  $('step').addEventListener('click', () => { pause(); pushOne() })
  $('speed').addEventListener('input', (e) => {
    state.speed = Number(e.target.value)
    $('speedLabel').textContent = state.speed
  })
  $('colorMode').addEventListener('change', (e) => {
    world.setColorMode(e.target.value)
    if (state.sim) legend()
  })

  const onClick = (e) => {
    const el = e.target.closest('button')
    if (!el) return
    const cur = state.crumbs.at(-1)
    if (el.dataset.crumb) {
      state.crumbs = state.crumbs.slice(0, Number(el.dataset.crumb) + 1)
      openDetail(state.crumbs.at(-1), 'keep')
    } else if (el.dataset.goto === 'item') {
      openDetail({ type: 'item', event: cur.event })
    } else if (el.dataset.goto === 'code' || (el.dataset.code && !el.dataset.goto)) {
      openDetail({ type: 'code', code: el.dataset.code })
    } else if (el.dataset.goto === 'truck' || el.dataset.truck) {
      openDetail({ type: 'truck', no: Number(el.dataset.no || el.dataset.truck || cur.event.box.truck) })
    } else if (el.dataset.event) {
      const ev = state.done.find((x) => x.eventId === el.dataset.event)
      if (ev) openDetail({ type: 'box', event: ev })
    }
  }
  root.addEventListener('click', onClick)

  init()

  return () => {
    pause()
    root.removeEventListener('click', onClick)
    if (mini) mini.dispose()
    world.dispose()
  }
}
