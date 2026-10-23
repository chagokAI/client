import { computed, ref } from 'vue'

const STORAGE_KEY = 'chagok.notifications.enabled'

/** 알림 설정 API가 없어 이 브라우저에만 저장한다. 저장값이 없으면 받는 상태로 시작한다. */
function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== '0'
  } catch {
    return true
  }
}

const isEnabled = ref(readStored())

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, isEnabled.value ? '1' : '0')
  } catch {
    /* 저장이 막힌 환경에서는 이번 세션에만 적용한다. */
  }
}

/** 프로필 메뉴의 토글과 사이드바 알림 배지가 같은 값을 보도록 모듈 단위로 공유한다. */
export function useNotificationSetting() {
  return {
    isEnabled: computed(() => isEnabled.value),
    setEnabled(value) {
      isEnabled.value = value
      persist()
    },
  }
}
