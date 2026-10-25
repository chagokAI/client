// SSE가 끊기거나 다른 서버 인스턴스로 연결돼도 주기 조회와 재접속 조회로 목록을 복구한다.
export function createNotificationFeed(
  url,
  load,
  accept,
  {
    EventSourceImpl = globalThis.EventSource,
    onNotification = () => {},
    onError = () => {},
    isVisible = () => globalThis.document?.visibilityState !== 'hidden',
  } = {},
) {
  let active = false
  let generation = 0
  let source = null
  let retry = null
  let poll = null
  let pending = null
  let controller = null
  let dirty = false
  const seen = new Set()
  function remember(id) {
    seen.add(id)
    if (seen.size > 1000) seen.delete(seen.values().next().value)
  }
  async function refresh() {
    if (!active) return
    if (pending) {
      dirty = true
      return pending
    }
    const current = generation
    controller = new AbortController()
    pending = (async () => {
      try {
        do {
          dirty = false
          const data = await load(controller.signal)
          if (!active || current !== generation) return
          // 조회 중 변경 이벤트가 오면 최신 응답을 다시 받아야 읽음 상태가 뒤로 돌아가지 않는다.
          if (dirty) continue
          data.items.forEach((item) => remember(item.id))
          accept(data)
          onError('')
        } while (dirty && active)
      } catch (error) {
        if (active && current === generation && error.name !== 'AbortError') onError(error.message)
      } finally {
        if (current === generation) pending = null
      }
    })()
    return pending
  }
  function connect() {
    if (!active || !EventSourceImpl) return
    const current = generation
    const connection = new EventSourceImpl(url, { withCredentials: true })
    source = connection
    connection.addEventListener('connected', () => {
      if (active && current === generation && connection === source) refresh()
    })
    connection.addEventListener('changed', (event) => {
      if (!active || current !== generation || connection !== source) return
      try {
        const { notification } = JSON.parse(event.data)
        if (notification && !seen.has(notification.id)) {
          remember(notification.id)
          onNotification(notification)
        }
      } catch {
        // 잘못된 이벤트도 목록 조회로 복구한다.
      }
      refresh()
    })
    connection.onerror = () => {
      if (!active || current !== generation || connection !== source) return
      if (connection.readyState === 2 && retry === null) {
        connection.close()
        retry = setTimeout(() => {
          retry = null
          connect()
        }, 10000)
      }
    }
  }
  return {
    refresh,
    start() {
      if (active) return
      active = true
      generation++
      refresh()
      connect()
      poll = setInterval(() => {
        if (isVisible()) refresh()
      }, 30000)
    },
    stop() {
      active = false
      generation++
      source?.close()
      source = null
      controller?.abort()
      pending = null
      clearTimeout(retry)
      clearInterval(poll)
      retry = null
      dirty = false
      seen.clear()
    },
  }
}
