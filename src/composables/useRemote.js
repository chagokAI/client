import { onBeforeUnmount, ref } from 'vue'

/** 이전 조회 응답이 새 필터의 결과를 덮지 않도록 취소한다. */
export function useRemote() {
  const loading = ref(false)
  const error = ref('')
  let controller
  let sequence = 0
  async function load(fetcher, accept) {
    const current = ++sequence
    controller?.abort()
    controller = new AbortController()
    loading.value = true
    error.value = ''
    try {
      const value = await fetcher(controller.signal)
      if (current === sequence) accept(value)
    } catch (cause) {
      if (current === sequence && cause.name !== 'AbortError') error.value = cause.message
    } finally {
      if (current === sequence) loading.value = false
    }
  }
  onBeforeUnmount(() => {
    sequence++
    controller?.abort()
  })
  return { loading, error, load }
}
