// 재생은 읽기 구독과 구별되는 서버 명령이다. 시작과 화면 이탈의 정지 요청도 같은 순서로 보낸다.
// 같은 페이지에서 탭을 떠났다가 돌아와도 이전 화면의 정지가 새 시작 뒤로 밀리지 않는다.
let serial = Promise.resolve()
export function createLiveInputControl(read, write, changed) {
  const controlId = globalThis.crypto.randomUUID()
  let state = { available: false, running: false, pending: 0 }
  let phase = 'loading'
  let busy = false
  let owned = false
  let disposed = false
  let disposal
  let timer
  let wake
  function notify(next, error = '') {
    phase = next
    if (!disposed) changed({ state, phase, error })
  }
  function command(running, ownedOnly = false) {
    const task = serial.catch(() => {}).then(() => write(running, { keepalive: true, ownedOnly, controlId }))
    serial = task
    return task
  }
  async function settle() {
    for (let attempts = 0; !state.running && state.pending > 0 && !disposed; attempts++) {
      if (attempts >= 40) throw new Error('입력은 중지했지만 접수된 작업을 처리 중입니다. 상태를 다시 확인해 주세요.')
      notify('stopping')
      await new Promise((resolve) => {
        wake = resolve
        timer = setTimeout(resolve, 250)
      })
      wake = null
      if (!disposed) state = await read()
    }
    if (!state.running && state.pending === 0) owned = false
    notify(!state.available ? 'unavailable' : state.running ? 'running' : 'paused')
  }
  return {
    async load() {
      if (busy || disposed) return
      busy = true
      notify('loading')
      try {
        await serial.catch(() => {})
        if (disposed) return
        state = await read()
        await settle()
      } catch (error) {
        notify('error', error.message)
      } finally {
        busy = false
      }
    },
    async toggle() {
      if (busy || disposed) return
      if (phase === 'error') return this.load()
      if (!state.available) return
      busy = true
      const running = !state.running
      if (running) owned = true
      notify(running ? 'starting' : 'stopping')
      try {
        state = await command(running)
        if (!running) owned = false
        if (!disposed) await settle()
      } catch (error) {
        notify('error', error.message)
      } finally {
        busy = false
      }
    },
    dispose() {
      if (disposed) return disposal
      disposed = true
      clearTimeout(timer)
      wake?.()
      disposal = owned ? command(false, true).catch(() => {}) : Promise.resolve()
      return disposal
    },
  }
}
