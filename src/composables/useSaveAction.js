import { ref } from 'vue'
import { useToast } from './useToast'

/**
 * 저장·삭제처럼 "한 번에 하나만, 끝나면 안내 문구" 패턴을 한곳에 모은다.
 * 중복 클릭을 막고(saving), 실패하면 에러 메시지를 토스트로 올린다.
 *
 * const { saving, toastMessage, run } = useSaveAction()
 * run(async () => { await warehouseApi(...) }, '저장되었습니다.')
 *
 * 같은 토스트를 쓰는 곁다리 조회는 잠금이 없는 report 를 쓴다. (useToast)
 */
export function useSaveAction() {
  const { toastMessage, report } = useToast()
  const saving = ref(false)

  async function run(action, successMessage) {
    if (saving.value) return false
    saving.value = true
    try {
      await action()
      if (successMessage) toastMessage.value = successMessage
      return true
    } catch (cause) {
      toastMessage.value = cause.message
      return false
    } finally {
      saving.value = false
    }
  }

  return { saving, toastMessage, run, report }
}
