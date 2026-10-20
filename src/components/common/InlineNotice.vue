<script setup>
defineProps({
  // 모달 하단에 저장 결과를 미리 알리는 안내 문구에 씁니다.
  tone: {
    type: String,
    default: 'cream',
  },
})
</script>

<template>
  <p class="inline-notice" :class="`inline-notice--${tone}`">
    <svg class="inline-notice__icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.2" />
      <path d="M8 4.8v3.6M8 10.9v.1" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
    </svg>
    <span><slot /></span>
  </p>
</template>

<style scoped>
.inline-notice {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  font-size: 12px;
  line-height: 1.55;
  word-break: keep-all;
}

.inline-notice--cream {
  background: var(--color-cream);
  color: var(--color-text-secondary);
}

.inline-notice--danger {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

.inline-notice__icon {
  width: 16px;
  height: 16px;
  flex: none;
  margin-top: 1px;
  color: var(--color-gold);
}

.inline-notice--danger .inline-notice__icon {
  color: var(--color-danger);
}

.inline-notice :deep(strong) {
  color: var(--color-brown);
  font-weight: 700;
}
</style>
