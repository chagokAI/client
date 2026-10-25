import { bindPageLifecycle, createLiveInputControl } from './input.js'

// 입력 실행은 로그인 세션이 소유한다. 화면 구독을 해제해도 서버 입력과 진행 중인 명령은 유지한다.
export function createLiveInputSession(read, write, { target = globalThis.window } = {}) {
  const listeners = new Set()
  let control = null
  let snapshot = null
  let disposed = false

  function ensureControl() {
    if (!control) {
      control = createLiveInputControl(read, write, (value) => {
        snapshot = value
        listeners.forEach((listener) => listener(value))
      })
    }
    return control
  }

  function hide() {
    const previous = control
    control = null
    return previous?.dispose()
  }
  const unbind = target
    ? bindPageLifecycle(target, {
        hide,
        restore: () => {
          if (!disposed) ensureControl().load()
        },
      })
    : () => {}

  return {
    attach(listener) {
      if (disposed) throw new Error('종료된 라이브 입력 세션입니다.')
      listeners.add(listener)
      if (snapshot) listener(snapshot)
      ensureControl().load()
      return {
        toggle: () => {
          if (!disposed) return ensureControl().toggle()
        },
        refresh: () => {
          if (!disposed) return ensureControl().refresh()
        },
        detach: () => listeners.delete(listener),
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      unbind()
      listeners.clear()
      snapshot = null
      return hide()
    },
  }
}
