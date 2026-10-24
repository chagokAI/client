// 구독은 서버 결과를 전달하기만 한다. 재연결 시 snapshot으로 현재고를 받고 애니메이션 이력은 재생하지 않는다.
export function createLiveSubscription(
  url,
  receive,
  { EventSourceImpl = globalThis.EventSource, onState = () => {} } = {},
) {
  let source = null
  let active = false
  let retry = null
  let generation = 0
  const seen = new Set()
  function connect() {
    if (!active) return
    retry = null
    const current = ++generation
    const connection = new EventSourceImpl(url, { withCredentials: true })
    source = connection
    onState('connecting')
    connection.onopen = () => {
      if (current === generation) onState('live')
    }
    connection.onerror = () => {
      if (current !== generation || !active) return
      onState('reconnecting')
      // HTTP 거절 등으로 CLOSED가 되면 브라우저는 재접속하지 않는다. 폭주 없이 10초 뒤 새 연결을 만든다.
      if (connection.readyState === 2 && retry === null) {
        connection.close()
        source = null
        retry = setTimeout(connect, 10000)
      }
    }
    for (const name of ['snapshot', 'packed', 'waiting', 'failed']) {
      connection.addEventListener(name, (event) => {
        if (current !== generation || !active) return
        try {
          const data = JSON.parse(event.data)
          if (name !== 'snapshot') {
            const key = name + ':' + data.eventId
            if (seen.has(key)) return
            seen.add(key)
            if (seen.size > 1000) seen.delete(seen.values().next().value)
          }
          receive(name, data)
        } catch {
          onState('error')
        }
      })
    }
  }
  return {
    start() {
      if (!active) {
        active = true
        connect()
      }
    },
    stop() {
      active = false
      generation++
      clearTimeout(retry)
      retry = null
      source?.close()
      source = null
      seen.clear()
      onState('paused')
    },
  }
}

export function mergeInventory(current, next) {
  return { ...current, inventory: next.inventory, stockBySize: next.stockBySize }
}

// 연결 직후·라이브 초기화의 snapshot만 장면을 비운다. 입고·실사는 진열대 숫자만 바꾸고 적재 중인 트럭을 유지한다.
export function snapshotResetsScene(currentBoxes, snapshot) {
  if (snapshot.reason !== 'stock') return true
  const ids = new Set(currentBoxes.map((box) => box.id))
  return snapshot.boxes.length !== ids.size || snapshot.boxes.some((box) => !ids.has(box.id))
}

// 재고는 증감 계산하지 않고 서버 버전을 따른다. 늦게 도착한 이벤트는 최신 입고·초기화를 되돌릴 수 없다.
export function mergeStockBoxes(current, incoming) {
  const boxes = new Map(current.map((box) => [box.id, box]))
  for (const box of incoming) {
    const previous = boxes.get(box.id)
    if (!previous || (box.version ?? 0) >= (previous.version ?? 0)) boxes.set(box.id, box)
  }
  return [...boxes.values()]
}

export function createInventoryRefresh(fetcher, accept, failed, { delayMs = 2000 } = {}) {
  let last = -Infinity
  let timer = null
  let running = false
  let pending = false
  let stopped = false
  const controller = new AbortController()
  const schedule = () => {
    if (stopped || running || timer !== null || !pending) return
    timer = setTimeout(
      async () => {
        timer = null
        pending = false
        running = true
        last = Date.now()
        try {
          const result = await fetcher(controller.signal)
          if (!stopped) accept(result)
        } catch (error) {
          if (!stopped && error.name !== 'AbortError') failed(error)
        } finally {
          running = false
          schedule()
        }
      },
      Math.max(0, delayMs - (Date.now() - last)),
    )
  }
  return {
    request() {
      if (!stopped) {
        pending = true
        schedule()
      }
    },
    stop() {
      stopped = true
      pending = false
      clearTimeout(timer)
      controller.abort()
    },
  }
}

// 재고는 화면 진입부터 자동으로 구독한다. 이탈 시 연결과 대기 중인 조회를 한 수명으로 종료한다.
export function createInventorySubscription(url, fetcher, accept, failed, options) {
  const refresh = createInventoryRefresh(fetcher, accept, failed)
  const stream = createLiveSubscription(url, () => refresh.request(), options)
  stream.start()
  return {
    stop() {
      stream.stop()
      refresh.stop()
    },
  }
}
