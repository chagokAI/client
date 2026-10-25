import { ref } from 'vue'

/**
 * 실패하면 그 메시지를 토스트로 올리는 공통 처리.
 * 목록 곁다리 조회처럼 "되면 쓰고 안 되면 알려만 준다"는 호출에 쓴다.
 * useSaveAction 의 run 과 달리 진행 중 잠금이 없어, 저장 동작 안에서 이어서 불러도 건너뛰지 않는다.
 */
export function useToast() {
  const toastMessage = ref('')

  async function report(action) {
    try {
      return await action()
    } catch (cause) {
      toastMessage.value = cause.message
    }
  }

  return { toastMessage, report }
}
