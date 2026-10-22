import { computed, ref } from 'vue'

const STORAGE_KEY = 'chagok.sidebar.collapsed'

/** 새로고침해도 접힘 상태가 유지되도록 저장값을 먼저 읽는다. */
function readStored() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' }
  catch { return false }
}

const isCollapsed = ref(readStored())
const isMobileOpen = ref(false)

function persist() {
  try { localStorage.setItem(STORAGE_KEY, isCollapsed.value ? '1' : '0') }
  catch { /* 저장이 막힌 환경에서는 이번 세션에만 적용한다. */ }
}

/** 사이드바 드로어 상태는 헤더와 레이아웃이 함께 쓰므로 모듈 단위로 공유한다. */
export function useSidebar() {
  return {
    isCollapsed: computed(() => isCollapsed.value),
    isMobileOpen: computed(() => isMobileOpen.value),
    toggle() { isCollapsed.value = !isCollapsed.value; persist() },
    expand() { if (isCollapsed.value) { isCollapsed.value = false; persist() } },
    openMobile() { isMobileOpen.value = true },
    closeMobile() { isMobileOpen.value = false },
  }
}
