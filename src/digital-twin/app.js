import { warehouseApi } from '@/stores/auth'
import { World, MiniView, fillColor } from './scene.js'
import { TRUCK_MM, simulate, vol } from './packing.js'
import { playbackTiming } from './playback.js'

/**
 * 물류공간 디지털트윈 화면을 root 안에 붙인다. 반환값을 부르면 타이머·3D 자원·이벤트를 정리한다.
 * 데이터는 기존 Spring API(로그인 세션)로 받는다: 출고 이벤트·DL 측정 치수 /simulation-state(from·to),
 * 박스 치수·재고·단가 /box-stocks, 물품 원본 /products/{id},
 * 에이전트 제안서 /ai-tasks → /procurement-proposals/{id}. 박스 선택·트럭 적재는 packing.js 에서 계산한다.
 *
 * 라인 두 줄에 같은 물품을 같은 순서로 흘린다.
 * - 기존 라인: 지금 보유한 박스만으로 고른다.
 * - 제안 라인: 보유 박스에 제안서의 신규 규격을 더해, 들어가는 박스 중 충전율이 가장 높은 것을 고른다.
 */
export function mountTwin(root, { onLive } = {}) {
  let disposed = false
  const $ = (id) => root.querySelector(`#${id}`)
  const n = (v) => (v ?? 0).toLocaleString('ko-KR')
  // 이벤트 시각(UTC ISO) → 한국 시각
  const kstTime = (at) =>
    new Date(at).toLocaleTimeString('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  const kstDateTime = (at) => new Date(at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
  const LANE_NAMES = ['기존', '제안']

  const state = {
    lanes: [], // [{ name, boxes, sim: { events, trucks, skipped }, done: [] }] 0 기존, 1 제안(제안서가 있을 때)
    mode: 'base', // 'base' 기본 시뮬레이션 · 'compare' 제안서 비교 시뮬레이션
    proposal: null, // { id, targetMonth, from, to, specs: [{ code, ... }] }
    total: 0, // 흘릴 행 수(두 라인 같음)
    next: 0, // 다음에 흘려보낼 행
    playing: false,
    speed: 2, // 건/초
    crumbs: [], // 상세 패널 이동 경로
  }
  let mini = null

  const world = new World($('scene'), { onSelect: (sel) => openDetail(sel, 'reset') })
  const lineOf = (ln) => world.lines[ln]
  const laneOf = (ev) => state.lanes[ev.lane]
  const compare = () => state.lanes.length > 1

  // ---------------------------------------------------------------- 데이터
  const PAGE = 500 // /simulation-state 한 번에 받는 상한(서버 제한)
  const MAX_EVENTS = 20000 // 화면에서 이어 받는 최대 건수(비교 탭의 분석 기간 전체가 들어가게)

  function init() {
    // 기본 구간: DL 측정이 있는 기간(2026-05 ~ 09)의 마지막 달 첫날 근무 시간
    $('from').value = '2026-09-01T08:00'
    $('to').value = '2026-09-01T20:00'
    $('limit').max = MAX_EVENTS
    $('limit').value = Math.min(Number($('limit').value), MAX_EVENTS)
    status('구간을 정해 불러오세요 · DL 측정 치수는 2026-05 ~ 09 구간에 있어요')
  }

  async function loadBoxes() {
    // 치수·단가·재고를 한 번에 주는 /box-stocks 에서 사용 중인 규격만 가져온다
    const { data } = await warehouseApi('/box-stocks', { query: { active: true, size: 100 } })
    return (data.items ?? [])
      .filter((b) => b.innerWidthMm)
      .map((b) => ({
        code: b.code,
        name: b.name,
        dims: [b.innerWidthMm, b.innerDepthMm, b.innerHeightMm],
        price: b.unitPriceKrw ?? null,
        stock: b.stock?.onHandQty ?? 0,
      }))
      .sort((a, b) => a.code.localeCompare(b.code, 'ko'))
  }

  const DL_FROM = '2026-05-01' // DL 측정 치수가 있는 기간
  const DL_TO = '2026-09-30'
  const LOOKBACK_DAYS = 90 // 에이전트가 신규 규격을 분석한 기간(생성 전날까지 90일, box_agent lookback_days)
  const kstDate = (at) => new Date(at).toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const addDays = (d, k) => new Date(Date.parse(`${d}T00:00:00Z`) + k * 864e5).toISOString().slice(0, 10)

  /** 에이전트가 끝낸 제안서 목록(기존 /ai-tasks). 같은 제안서는 한 번만, 최신 순 */
  async function listProposals() {
    const { data: tasks } = await warehouseApi('/ai-tasks')
    const seen = new Set()
    return (tasks ?? []).filter(
      (t) => t.proposalId && t.status === 'DONE' && !seen.has(t.proposalId) && seen.add(t.proposalId),
    )
  }

  /** DB 의 제안서 한 건(기존 /procurement-proposals/{id})을 비교 시뮬레이션 설정으로 바꾼다. 신규 규격이 없으면 null */
  async function loadProposal(id) {
    const { data: p } = await warehouseApi(`/procurement-proposals/${id}`)
    const qty = Object.fromEntries(
      (p.analysis?.lines ?? []).filter((l) => l.type === 'NEW_SPEC').map((l) => [l.boxCode, l.qty]),
    )
    const specs = (p.analysis?.newSpecs ?? [])
      .filter((s) => s.dims?.length === 3)
      .map((s) => ({
        code: s.code,
        name: s.name,
        dims: s.dims,
        price: s.price ?? null,
        stock: qty[s.code] ?? 0,
        fillBefore: s.fillBefore,
        fillAfter: s.fillAfter,
        replaces: s.replaces ?? [],
      }))
    if (!specs.length) return null
    // 분석 기간 = 생성 전날까지 90일. 그중 DL 측정 치수가 있는 날만 흘린다
    const to = addDays(kstDate(p.generatedAt), -1)
    const from = addDays(to, -(LOOKBACK_DAYS - 1))
    const simFrom = from > DL_FROM ? from : DL_FROM
    const simTo = to < DL_TO ? to : DL_TO
    return { id, targetMonth: p.targetMonth, from, to, simFrom, simTo, specs }
  }

  /** 비교 탭: 제안서를 고르면 신규 규격·구간·건수만 맞춘다. 불러오기는 '구간 불러오기'로 */
  async function applyProposal(id) {
    pause()
    status('제안서 불러오는 중…')
    try {
      const seq = ++loadSeq
      const proposal = await loadProposal(id)
      if (seq !== loadSeq) return
      state.proposal = proposal
      if (!proposal) return status('이 제안서에는 신규 규격이 없어 비교할 게 없어요')
      if (proposal.simFrom > proposal.simTo)
        return status(`분석 기간(${proposal.from} ~ ${proposal.to})에 DL 측정 치수가 없어요`)
      $('from').value = `${proposal.simFrom}T00:00`
      $('to').value = `${proposal.simTo}T23:59`
      $('limit').value = MAX_EVENTS
      status(
        `${proposal.targetMonth} 제안서로 세팅함 (${proposal.specs.map((s) => s.code).join(', ')} 추가) · 구간 불러오기를 누르세요`,
      )
    } catch (e) {
      status(`제안서 불러오기 실패: ${e.message}`)
    }
  }

  let baseRange = null

  async function setMode(mode) {
    if (mode === state.mode) return
    if (mode === 'compare') baseRange = { from: $('from').value, to: $('to').value, limit: $('limit').value }
    state.mode = mode
    root.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === mode))
    $('proposalPick').hidden = mode !== 'compare'
    if (mode === 'base') {
      // 비교 탭이 바꿔 둔 구간·건수를 기본 시뮬레이션 값으로 되돌린다
      state.proposal = null
      Object.entries(baseRange).forEach(([k, v]) => {
        $(k).value = v
      })
      return load()
    }
    pause()
    try {
      const list = await listProposals()
      if (!list.length) {
        $('proposal').innerHTML = ''
        return status('에이전트가 만든 제안서가 아직 없어요 · 개선 실행으로 제안서를 먼저 만들어 주세요')
      }
      $('proposal').innerHTML = list
        .map(
          (t) =>
            `<option value="${t.proposalId}">${esc(t.targetMonth)} 발주 제안 · ` +
            `${esc(kstDateTime(t.completedAt ?? t.createdAt))}</option>`,
        )
        .join('')
      await applyProposal(list[0].proposalId)
    } catch (e) {
      status(`제안서 목록 실패: ${e.message}`)
    }
  }

  /** 기간의 이벤트를 500건씩 이어 받는다. 다음 페이지는 마지막 시각부터(같은 시각 중복은 eventId 로 거른다) */
  async function fetchEvents(from, to, limit, seq) {
    const out = []
    const seen = new Set()
    let cursor = from
    while (out.length < limit) {
      const { data } = await warehouseApi('/simulation-state', { query: { from: cursor, to, limit: PAGE } })
      if (seq !== loadSeq) return null // 그사이 다른 불러오기가 시작됨
      const fresh = data.items.filter((o) => !seen.has(o.eventId))
      fresh.forEach((o) => seen.add(o.eventId))
      out.push(...fresh)
      status(`불러오는 중… ${n(Math.min(out.length, limit))}건`)
      if (data.items.length < PAGE || !fresh.length) break
      cursor = data.items.at(-1).observedAt
    }
    return out.slice(0, limit)
  }

  // 불러오기 차례 번호: 탭을 바꿔 새로 불러오면 앞선 불러오기 결과는 버린다(늦게 끝난 쪽이 덮어쓰지 않게)
  let loadSeq = 0

  async function load() {
    if (disposed) return
    pause()
    const seq = ++loadSeq
    status('불러오는 중…')
    try {
      const limit = Math.min(Number($('limit').value) || 300, MAX_EVENTS)
      const kst = (v) => `${v}:00+09:00`
      const proposal = state.mode === 'compare' ? state.proposal : null
      const [boxes, items] = await Promise.all([
        loadBoxes(),
        fetchEvents(kst($('from').value), kst($('to').value), limit, seq),
      ])
      if (seq !== loadSeq || !items) return
      const lanes = [{ name: LANE_NAMES[0], boxes }]
      if (proposal) lanes.push({ name: LANE_NAMES[1], boxes: [...boxes, ...proposal.specs] })
      lanes.forEach((lane, i) => {
        lane.sim = simulate(items, lane.boxes)
        lane.sim.events.forEach((ev) => {
          ev.lane = i
        })
        lane.done = []
      })
      state.lanes = lanes
      state.proposal = proposal
      state.total = lanes[0].sim.events.length
      state.next = 0
      world.reset(
        TRUCK_MM,
        [boxes, proposal ? lanes[1].boxes : null],
        new Set(proposal?.specs.map((s) => s.code) ?? []),
      )
      legend()
      $('log').innerHTML = ''
      renderStats()
      $('play').disabled = $('step').disabled = $('skip').disabled = !state.total
      const full = items.length >= limit ? ` (최대 ${n(limit)}건까지)` : ''
      status(
        `${n(state.total)}건 불러옴${full} · ` +
          (compare()
            ? `트럭 기존 ${lanes[0].sim.trucks}대 · 제안 ${lanes[1].sim.trucks}대 예정`
            : `트럭 ${lanes[0].sim.trucks}대 예정`),
      )
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
    return playbackTiming(state.speed).itemDuration
  }

  /** 다음 물품을 넣기 전에 트럭을 바꿔야 하는 라인들 */
  function lanesToSwap() {
    return state.lanes
      .map((lane, i) => ({ i, ev: lane.sim.events[state.next] }))
      .filter(({ i, ev }) => ev.box && ev.box.truck !== lineOf(i).current().no)
  }

  function swap(i, ev, duration) {
    const cur = lineOf(i).current()
    lineOf(i).swapTruck(ev.box.truck, duration)
    log(`${prefix(i)}트럭 ${cur.no} 출발 (${cur.boxes.length}상자) → 트럭 ${ev.box.truck} 진입`, 'truck')
  }

  const prefix = (i) => (compare() ? `[${LANE_NAMES[i]}] ` : '')

  function pushOne(quiet = false) {
    if (!state.lanes.length || state.next >= state.total || swapping) return false
    const swaps = lanesToSwap()
    if (swaps.length) {
      // 꽉 찬 트럭: 그 라인에서 실려 가는 상자가 다 내려앉은 뒤 출발
      if (swaps.some(({ i }) => world.busy(lineOf(i)))) return false
      swapping = true
      const d = playbackTiming(state.speed).truckDuration
      swaps.forEach(({ i, ev }) => swap(i, ev, d))
      setTimeout(() => {
        swapping = false
      }, d * 1000)
      renderStats()
      return false
    }
    const evs = state.lanes.map((lane, i) => {
      const ev = lane.sim.events[state.next]
      lineOf(i).push(ev, stepDuration())
      lane.done.push(ev)
      return ev
    })
    state.next += 1
    if (!quiet) {
      showNow(evs)
      const [a, b] = evs
      const pick = (ev) => (ev.box ? `${ev.box.code} (${ev.box.fill}%)` : '맞는 박스 없음')
      log(
        `${kstTime(a.at)} ${a.item.name} → ${pick(a)}${b ? ` | 제안 ${pick(b)}` : ''}`,
        !a.box ? 'miss' : b?.box && b.box.code !== a.box.code ? 'diff' : '',
      )
    }
    if (!quiet && (state.next % 5 === 0 || state.next === state.total)) renderStats()
    if (state.next === state.total) {
      renderStats()
      status(`끝 · ${n(state.total)}건 처리, ${truckSummary()}`)
      pause()
    }
    return true
  }

  const truckSummary = () =>
    state.lanes.map((l) => `${compare() ? l.name + ' ' : ''}트럭 ${l.sim.trucks}대`).join(' · ')

  function play() {
    if (!state.lanes.length) return
    state.playing = true
    $('play').textContent = '❚❚ 일시정지'
    // 초당 60건이 넘으면 한 번에 여러 건씩 흘린다(타이머는 16ms 아래로 내려가지 않는다)
    const tick = () => {
      if (!state.playing) return
      const batch = Math.max(1, Math.ceil(state.speed / 60))
      for (let i = 0; i < batch && state.playing; i++) if (!pushOne(batch > 1 && i < batch - 1)) break
      timer = setTimeout(tick, batch > 1 ? 16 : playbackTiming(state.speed).intervalMs)
    }
    tick()
  }

  /** 남은 물품을 애니메이션 없이 모두 처리해 결과(모든 트럭 적재·통계)를 바로 보여 준다 */
  function skipToEnd() {
    if (!state.lanes.length || state.next >= state.total) return
    pause()
    world.finishAll()
    swapping = false
    world.beginBulk()
    while (state.next < state.total) {
      lanesToSwap().forEach(({ i, ev }) => swap(i, ev, 0))
      state.lanes.forEach((lane, i) => {
        const ev = lane.sim.events[state.next]
        lineOf(i).push(ev, 0)
        lane.done.push(ev)
      })
      state.next += 1
    }
    world.endBulk()
    showNow(state.lanes.map((l) => l.sim.events.at(-1)))
    log(`결과로 건너뜀 · ${n(state.total)}건 처리`, '')
    renderStats()
    status(`끝 · ${n(state.total)}건 처리, ${truckSummary()} (결과로 건너뜀)`)
  }

  function pause() {
    state.playing = false
    clearTimeout(timer)
    $('play').textContent = '▶ 재생'
  }

  // ---------------------------------------------------------------- 화면 조각
  function status(t) {
    $('status').textContent = t
  }

  function log(text, cls) {
    const li = document.createElement('li')
    li.textContent = text
    if (cls) li.className = cls
    $('log').prepend(li)
    while ($('log').children.length > 200) $('log').lastChild.remove()
  }

  function showNow([ev, pev]) {
    const pick = (e) =>
      e.box
        ? `<b>${esc(e.box.code)}</b> ${e.box.dims.join('×')}mm · 충전율 <b>${e.box.fill}%</b> · 트럭 ${e.box.truck}`
        : '보유 박스 어디에도 들어가지 않음'
    $('now').innerHTML =
      `<b>${esc(ev.item.name)}</b> · ${ev.item.dims.join('×')}mm <span class="tag">${esc(ev.item.source)}</span><br>` +
      (pev
        ? `기존 → ${pick(ev)}<br>제안 → ${pick(pev)}`
        : `→ ${pick(ev)}${ev.box ? ` · 빈 공간 ${n(ev.box.emptyCm3)}cm³` : ''}`)
  }

  function legend() {
    const el = $('legend')
    if (world.colorMode === 'fill') {
      el.innerHTML =
        [10, 30, 50, 70]
          .map((v) => `<span><i style="background:#${fillColor(v).getHexString()}"></i>${v}%</span>`)
          .join('') + '<span>충전율 낮음 → 높음</span>'
    } else {
      el.innerHTML = state.lanes
        .at(-1)
        .boxes.map(
          (b) =>
            `<span><i style="background:${world.codeColor[b.code]}"></i>${esc(b.code)}` +
            `${world.isNew.has(b.code) ? ' ★신규' : ''}</span>`,
        )
        .join('')
    }
  }

  /** 라인 하나의 지금까지 결과: 트럭 수(상자가 실린 것), 평균 충전율, 상자 부피, 신규 규격 사용 */
  function laneNow(ln) {
    const lane = state.lanes[ln]
    const packed = lane.done.filter((e) => e.box)
    return {
      trucks: lineOf(ln).trucks.filter((t) => t.boxes.length || (t === lineOf(ln).current() && packed.length)).length,
      planned: lane.sim.trucks,
      fill: packed.length ? packed.reduce((s, e) => s + e.box.fill, 0) / packed.length : null,
      boxM3: packed.reduce((s, e) => s + vol(e.box.dims), 0) / 1e9,
      fresh: packed.filter((e) => world.isNew.has(e.box.code)).length,
      miss: lane.done.length - packed.length,
    }
  }

  /** 두 라인 비교판: 트럭 수를 아이콘 줄과 숫자로 나란히 보여 준다 */
  function renderCompare() {
    const el = $('compare')
    if (!compare()) {
      el.innerHTML = ''
      return
    }
    const [a, b] = [laneNow(0), laneNow(1)]
    const diff = a.planned - b.planned
    const pct = a.planned ? Math.round((100 * diff) / a.planned) : 0
    const icons = (k) => '🚚'.repeat(Math.min(k, 30)) + (k > 30 ? ` +${k - 30}` : '')
    const row = (name, x, cls) =>
      `<div class="cmp__row ${cls}"><span class="cmp__name">${name}</span>` +
      `<span class="cmp__trucks">${icons(x.trucks)}</span><b class="cmp__num">${x.trucks}<small>/${x.planned}대</small></b></div>` +
      `<div class="cmp__sub">평균 충전율 ${x.fill == null ? '—' : x.fill.toFixed(1) + '%'} · 상자 부피 ${x.boxM3.toFixed(2)}m³` +
      `${x.fresh ? ` · 신규 규격 ${n(x.fresh)}건` : ''}${x.miss ? ` · 박스 없음 ${n(x.miss)}건` : ''}</div>`
    const done = state.next === state.total
    const p = state.proposal
    el.innerHTML =
      `<h3>제안서 효과 <small>${esc(p.targetMonth)} 발주 · ${p.specs.map((s) => esc(s.code)).join(', ')} 추가</small></h3>` +
      `<p class="cmp__basis">분석 기간 ${p.from} ~ ${p.to} · 시뮬레이션 ${$('from').value.slice(0, 10)} ~ ${$('to').value.slice(0, 10)}</p>` +
      row('기존', a, '') +
      row('제안', b, 'cmp__row--new') +
      `<p class="cmp__diff ${diff > 0 ? 'good' : ''}">${diff > 0 ? `트럭 ${diff}대 줄어듦 (−${pct}%)` : diff < 0 ? `트럭 ${-diff}대 늘어남` : '트럭 수 같음'}` +
      `${done ? '' : ' <small>· 전체 구간 기준 예정</small>'}</p>`
  }

  function boxStatsNow(ln) {
    // 지금까지 흘린 것 기준 호수별 사용·평균 충전율·남은 재고
    const lane = state.lanes[ln]
    return lane.boxes.map((b) => {
      const evs = lane.done.filter((e) => e.box && e.box.code === b.code)
      const avg = evs.length ? evs.reduce((s, e) => s + e.box.fill, 0) / evs.length : null
      return { ...b, used: evs.length, avgFill: avg, stockNow: b.stock - evs.length }
    })
  }

  function renderStats() {
    if (!state.lanes.length) return
    renderCompare()
    const stats = state.lanes.map((_, i) => boxStatsNow(i))
    const fmt = (s) => (s ? `${n(s.used)}${s.avgFill == null ? '' : ` <small>${s.avgFill.toFixed(1)}%</small>`}` : '—')
    $('boxStats').innerHTML =
      (compare()
        ? '<table><tr><th>호수</th><th class="num">기존 사용</th><th class="num">제안 사용</th><th class="num">제안 재고</th></tr>' +
          stats[1]
            .map((p) => {
              const a = stats[0].find((x) => x.code === p.code)
              return (
                `<tr><td><button class="link" data-code="${esc(p.code)}" data-lane="${a ? 0 : 1}">${esc(p.code)}</button>${world.isNew.has(p.code) ? ' ★' : ''}</td>` +
                `<td class="num">${fmt(a)}</td><td class="num">${fmt(p)}</td><td class="num">${n(p.stockNow)}</td></tr>`
              )
            })
            .join('')
        : '<table><tr><th>호수</th><th class="num">사용</th><th class="num">평균 충전율</th><th class="num">재고</th></tr>' +
          stats[0]
            .map(
              (s) =>
                `<tr><td><button class="link" data-code="${esc(s.code)}" data-lane="0">${esc(s.code)}</button></td>` +
                `<td class="num">${n(s.used)}</td><td class="num">${s.avgFill == null ? '—' : s.avgFill.toFixed(1) + '%'}</td>` +
                `<td class="num">${n(s.stockNow)}</td></tr>`,
            )
            .join('')) + '</table>'
    const cap = TRUCK_MM.reduce((a, b) => a * b, 1)
    $('trucks').innerHTML = state.lanes
      .map(
        (lane, i) =>
          (compare() ? `<h4>${lane.name} 라인</h4>` : '') +
          lineOf(i)
            .trucks.map((t) => {
              const load = (100 * t.boxes.reduce((s, e) => s + vol(e.box.size), 0)) / cap
              return (
                `<div><button class="link" data-truck="${t.no}" data-lane="${i}">트럭 ${t.no}</button> · ${t.boxes.length}상자 · 적재율 ${load.toFixed(1)}%` +
                `<div class="bar-fill"><i style="width:${load}%;background:#603c22"></i></div></div>`
              )
            })
            .join(''),
      )
      .join('')
  }

  // ---------------------------------------------------------------- 상세 패널 (상자 → 물품 원본 → 호수 통계 → 트럭)
  function crumbLabel(c) {
    const p = c.lane != null ? prefix(c.lane) : c.event ? prefix(c.event.lane) : ''
    return {
      home: '처음',
      box: `${p}상자 ${c.event?.box?.code ?? ''}`,
      item: '물품 원본',
      code: `${p}${c.code} 통계`,
      truck: `${p}트럭 ${c.no}`,
    }[c.type]
  }

  // mode: 'reset'(새로 시작) · 'push'(따라 들어가기) · 'keep'(경로 그대로, 경로 버튼으로 되돌아갈 때)
  function openDetail(sel, mode = 'push') {
    if (mode === 'reset') state.crumbs = [sel]
    else if (mode === 'push') state.crumbs.push(sel)
    renderCrumbs()
    const d = $('detail')
    if (mini) {
      mini.dispose()
      mini = null
    }
    // 처음(home)은 팝업을 닫고, 그 밖에는 팝업으로 띄운다
    $('popup').hidden = sel.type === 'home'
    if (sel.type === 'home') {
      d.innerHTML = ''
    } else if (sel.type === 'box') {
      d.innerHTML = boxView(sel.event)
      mini = new MiniView(d.querySelector('.mini'))
      mini.show(sel.event, world.boxColor(sel.event))
    } else if (sel.type === 'item') {
      d.innerHTML = itemView(sel.event)
    } else if (sel.type === 'code') {
      d.innerHTML = codeView(sel.code, sel.lane ?? 0)
    } else if (sel.type === 'truck') {
      d.innerHTML = truckView(sel.no, sel.lane ?? 0)
    }
  }

  function renderCrumbs() {
    $('crumbs').innerHTML = state.crumbs
      .map(
        (c, i) =>
          `<button data-crumb="${i}" class="${i === state.crumbs.length - 1 ? 'on' : ''}">${esc(crumbLabel(c))}</button>`,
      )
      .join('<span>›</span>')
  }

  function boxView(ev) {
    const b = ev.box
    const rows = ev.candidates
      .map(
        (c) =>
          `<tr class="${c.code === b.code ? 'pick' : c.fits ? '' : 'no'}">` +
          `<td>${esc(c.code)}${world.isNew.has(c.code) ? ' ★' : ''}</td><td>${c.dims.join('×')}</td><td class="num">${c.fill == null ? '—' : c.fill + '%'}</td>` +
          `<td class="num">${n(c.stock)}</td><td>${esc(c.reason)}</td></tr>`,
      )
      .join('')
    // 같은 물품이 다른 라인에서는 어떤 박스에 담겼는지
    const other = compare() ? state.lanes[1 - ev.lane].sim.events.find((x) => x.eventId === ev.eventId) : null
    return `<h2>${esc(b.code)} <small>${esc(b.name ?? '')} · ${esc(laneOf(ev).name)} 라인</small></h2>
      <div class="mini"></div>
      <dl class="kv">
        <dt>충전율</dt><dd><b>${b.fill}%</b></dd>
        <dt>빈 공간</dt><dd>${n(b.emptyCm3)} cm³ (상자 ${n(Math.round(vol(b.dims) / 1000))} cm³)</dd>
        <dt>상자 내치수</dt><dd>${b.dims.join(' × ')} mm · ${n(b.price)}원</dd>
        <dt>물품</dt><dd><button class="link" data-goto="item">${esc(ev.item.name)}</button> · ${ev.item.dims.join(' × ')} mm</dd>
        <dt>트럭</dt><dd><button class="link" data-goto="truck">트럭 ${b.truck}</button> · 위치 ${b.pos.join(', ')} mm</dd>
        ${other ? `<dt>${esc(state.lanes[other.lane].name)} 라인</dt><dd>${other.box ? `${esc(other.box.code)} · 충전율 ${other.box.fill}% · 트럭 ${other.box.truck}` : '맞는 박스 없음'}</dd>` : ''}
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
        <dt>측정 치수</dt><dd>${it.dims.join(' × ')} mm · 부피 ${n(Math.round(vol(it.dims) / 1000))} cm³</dd>
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
      const set = (k, v) => {
        const el = root.querySelector(`[data-product="${k}"]`)
        if (el) el.textContent = v
      }
      set('category', p.category?.name ?? '—')
      set('barcode', p.barcode ?? '—')
      set('weight', p.weightG ? `${n(p.weightG)} g` : '—')
      set('label', p.widthMm ? `${p.widthMm} × ${p.depthMm} × ${p.heightMm} mm` : '—')
    } catch {
      /* 상품 상세를 못 불러와도 측정값은 보여 준다 */
    }
  }

  function codeView(code, ln) {
    const s = boxStatsNow(ln).find((x) => x.code === code)
    if (!s) return '<p>이 라인에는 없는 박스예요.</p>'
    const evs = state.lanes[ln].done.filter((e) => e.box && e.box.code === code)
    const fills = evs.map((e) => e.box.fill)
    const buckets = [0, 20, 40, 60, 80].map((lo) => fills.filter((f) => f >= lo && f < lo + 20).length)
    const max = Math.max(1, ...buckets)
    const trucks = [...new Set(evs.map((e) => e.box.truck))]
    const spec = state.proposal?.specs.find((x) => x.code === code)
    return `<h2>${esc(code)} 호수 통계${spec ? ' <small>★ 제안 신규 규격</small>' : ''}</h2>
      <dl class="kv">
        <dt>내치수</dt><dd>${s.dims.join(' × ')} mm · ${n(s.price)}원</dd>
        ${spec ? `<dt>제안서</dt><dd>${esc(spec.replaces.join('·'))} 대상 출고 충전율 ${spec.fillBefore}% → ${spec.fillAfter}% 예상</dd>` : ''}
        <dt>사용</dt><dd>${n(s.used)}개 (지금까지 흘린 ${n(state.next)}건 중)</dd>
        <dt>평균 충전율</dt><dd>${s.avgFill == null ? '—' : s.avgFill.toFixed(1) + '%'}</dd>
        <dt>재고</dt><dd>시작 ${n(s.stock)} → 지금 ${n(s.stockNow)}</dd>
      </dl>
      <h3>충전율 분포</h3>
      ${buckets.map((c, i) => `<div>${i * 20}~${i * 20 + 20}% · ${c}개<div class="bar-fill"><i style="width:${(100 * c) / max}%;background:#${fillColor(i * 20 + 10).getHexString()}"></i></div></div>`).join('')}
      <h3>담긴 물품 (최근 10)</h3>
      <ul>${
        evs
          .slice(-10)
          .reverse()
          .map(
            (e) =>
              `<li><button class="link" data-event="${esc(e.eventId)}" data-lane="${ln}">${esc(e.item.name)}</button> ${e.box.fill}%</li>`,
          )
          .join('') || '<li>없음</li>'
      }</ul>
      <h3>실린 트럭</h3>
      <p>${trucks.map((t) => `<button class="link" data-goto="truck" data-no="${t}" data-lane="${ln}">트럭 ${t}</button>`).join(' · ') || '—'}</p>`
  }

  function truckView(no, ln) {
    const line = lineOf(ln)
    const t = line.trucks.find((x) => x.no === no)
    if (!t) return '<p>아직 없는 트럭이에요.</p>'
    const cap = TRUCK_MM.reduce((a, b) => a * b, 1)
    const boxVol = t.boxes.reduce((s, e) => s + vol(e.box.size), 0)
    const itemVol = t.boxes.reduce((s, e) => s + vol(e.item.dims), 0)
    const byCode = {}
    t.boxes.forEach((e) => {
      byCode[e.box.code] = (byCode[e.box.code] ?? 0) + 1
    })
    return `<h2>트럭 ${no}${compare() ? ` <small>${esc(state.lanes[ln].name)} 라인</small>` : ''}</h2>
      <dl class="kv">
        <dt>적재함</dt><dd>${TRUCK_MM.join(' × ')} mm</dd>
        <dt>상자</dt><dd>${n(t.boxes.length)}개</dd>
        <dt>상자 적재율</dt><dd>${((100 * boxVol) / cap).toFixed(1)}% (상자 부피 / 적재함)</dd>
        <dt>물품 적재율</dt><dd>${((100 * itemVol) / cap).toFixed(1)}% (물품 부피 / 적재함)</dd>
        <dt>상태</dt><dd>${t === line.current() ? '싣는 중' : '출발함'}</dd>
      </dl>
      <h3>호수별</h3>
      <p>${
        Object.entries(byCode)
          .map(
            ([c, k]) =>
              `<button class="link" data-goto="code" data-code="${esc(c)}" data-lane="${ln}">${esc(c)}</button> ${k}개`,
          )
          .join(' · ') || '—'
      }</p>
      <h3>실린 상자 (최근 10)</h3>
      <ul>${
        t.boxes
          .slice(-10)
          .reverse()
          .map(
            (e) =>
              `<li><button class="link" data-event="${esc(e.eventId)}" data-lane="${ln}">${esc(e.box.code)} · ${esc(e.item.name)}</button> ${e.box.fill}%</li>`,
          )
          .join('') || '<li>없음</li>'
      }</ul>`
  }

  // ---------------------------------------------------------------- 이벤트 연결
  $('load').addEventListener('click', load)
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      if (b.dataset.tab === 'live') {
        pause()
        onLive?.()
        return
      }
      setMode(b.dataset.tab)
    }),
  )
  $('proposal').addEventListener('change', (e) => applyProposal(e.target.value))
  $('play').addEventListener('click', () => (state.playing ? pause() : play()))
  $('step').addEventListener('click', () => {
    pause()
    pushOne()
  })
  $('skip').addEventListener('click', skipToEnd)
  $('speed').addEventListener('input', (e) => {
    state.speed = Number(e.target.value)
    $('speedLabel').textContent = state.speed
  })
  $('colorMode').addEventListener('change', (e) => {
    world.setColorMode(e.target.value)
    if (state.lanes.length) legend()
  })

  const onClick = (e) => {
    const el = e.target.closest('button')
    if (!el) return
    const cur = state.crumbs.at(-1)
    // 버튼에 라인이 없으면 지금 보고 있는 것의 라인을 따른다
    const ln = el.dataset.lane != null ? Number(el.dataset.lane) : (cur?.lane ?? cur?.event?.lane ?? 0)
    if (el.dataset.crumb) {
      state.crumbs = state.crumbs.slice(0, Number(el.dataset.crumb) + 1)
      openDetail(state.crumbs.at(-1), 'keep')
    } else if (el.dataset.goto === 'item') {
      openDetail({ type: 'item', event: cur.event })
    } else if (el.dataset.goto === 'code' || (el.dataset.code && !el.dataset.goto)) {
      openDetail({ type: 'code', code: el.dataset.code, lane: ln })
    } else if (el.dataset.goto === 'truck' || el.dataset.truck) {
      openDetail({ type: 'truck', no: Number(el.dataset.no || el.dataset.truck || cur.event.box.truck), lane: ln })
    } else if (el.dataset.event) {
      const ev = state.lanes[ln]?.done.find((x) => x.eventId === el.dataset.event)
      if (ev) openDetail({ type: 'box', event: ev })
    }
  }
  root.addEventListener('click', onClick)
  $('popupClose').addEventListener('click', () => openDetail({ type: 'home' }, 'reset'))

  init()

  return () => {
    disposed = true
    loadSeq++
    pause()
    root.removeEventListener('click', onClick)
    if (mini) mini.dispose()
    world.dispose()
  }
}
