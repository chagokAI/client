<script setup>
import { onBeforeUnmount, onMounted } from 'vue'
import { useSidebar } from '@/composables/useSidebar'

const props = defineProps({
  message: {
    type: String,
    required: true,
  },
  // 0을 넘기면 자동으로 닫히지 않습니다.
  duration: {
    type: Number,
    default: 4000,
  },
})

const { isCollapsed } = useSidebar()

const emit = defineEmits(['close'])
let timer = null

onMounted(() => {
  if (props.duration > 0) {
    timer = setTimeout(() => emit('close'), props.duration)
  }
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <div class="app-toast" :class="{ 'app-toast--collapsed': isCollapsed }" role="status">
    <svg class="app-toast__icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="10" fill="#2f9e5e" />
      <path
        d="m6 10.2 2.6 2.6L14 7.4"
        stroke="#ffffff"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
    <p class="app-toast__message">{{ message }}</p>
  </div>
</template>

<style scoped>
.app-toast {
  position: fixed;
  /* 높이는 화면 위쪽, 가로는 사이드바를 뺀 본문 영역의 가운데에 띄웁니다. */
  top: calc(var(--header-height) + 20px);
  left: calc(var(--sidebar-width) + (100vw - var(--sidebar-width)) / 2);
  z-index: 120;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: calc(100vw - var(--sidebar-width) - 32px);
  padding: 14px 24px;
  border-radius: var(--radius-md);
  background: var(--color-navy);
  color: var(--color-white);
  box-shadow: var(--shadow-popover);
  transform: translateX(-50%);
}

.app-toast--collapsed {
  left: calc(var(--sidebar-width-collapsed) + (100vw - var(--sidebar-width-collapsed)) / 2);
  max-width: calc(100vw - var(--sidebar-width-collapsed) - 32px);
}

/* 좁은 화면에서는 사이드바가 본문을 덮는 드로어라 화면 전체 기준으로 가운데에 둡니다. */
@media (max-width: 900px) {
  .app-toast,
  .app-toast--collapsed {
    left: 50%;
    max-width: calc(100vw - 32px);
  }
}

.app-toast__icon {
  width: 20px;
  height: 20px;
  flex: none;
}

.app-toast__message {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  word-break: keep-all;
}
</style>
