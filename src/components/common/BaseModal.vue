<script setup>
import { onBeforeUnmount, onMounted, useId, useTemplateRef } from 'vue'

defineProps({
  title: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  width: {
    type: String,
    default: '600px',
  },
  // 삭제 확인처럼 제목 줄과 닫기 버튼이 없는 가운데 정렬형 모달
  compact: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['close'])
const titleId = useId()
const dialog = useTemplateRef('dialog')

// 모달이 열려 있는 동안에만 배경 스크롤을 잠급니다.
const previousOverflow = document.body.style.overflow

function handleKeydown(event) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.body.style.overflow = 'hidden'
  document.addEventListener('keydown', handleKeydown)
  dialog.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div
      ref="dialog"
      class="modal"
      :class="{ 'modal--compact': compact }"
      :style="{ maxWidth: width }"
      role="dialog"
      aria-modal="true"
      :aria-labelledby="title ? titleId : undefined"
      tabindex="-1"
    >
      <header v-if="!compact" class="modal__header">
        <div class="modal__heading">
          <div class="modal__title-row">
            <h2 :id="titleId" class="modal__title">{{ title }}</h2>
            <slot name="title-badge" />
          </div>
          <p v-if="description" class="modal__description">{{ description }}</p>
        </div>

        <button class="modal__close" type="button" aria-label="닫기" @click="emit('close')">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </button>
      </header>

      <div class="modal__body">
        <slot />
      </div>

      <footer v-if="$slots.footer" class="modal__footer" :class="{ 'modal__footer--compact': compact }">
        <slot name="footer" />
      </footer>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: rgb(32 42 56 / 45%);
  overflow-y: auto;
}

.modal {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 100%;
  border-radius: var(--radius-lg);
  background: var(--color-white);
  box-shadow: var(--shadow-modal);
}

.modal:focus {
  outline: none;
}

.modal__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 24px 24px 16px;
  border-bottom: 1px solid var(--color-divider);
}

.modal__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.modal__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.4px;
}

.modal__description {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.modal__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 160ms ease;
}

.modal__close:hover {
  background: var(--color-cream);
  color: var(--color-text);
}

.modal__close svg {
  width: 16px;
  height: 16px;
}

.modal__body {
  flex: 1;
  min-height: 0;
  padding: 20px 24px;
  overflow-y: auto;
}

.modal--compact .modal__body {
  padding: 32px 28px 20px;
  text-align: center;
}

.modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 24px 20px;
  border-top: 1px solid var(--color-divider);
}

.modal__footer--compact {
  padding: 0 28px 28px;
  border-top: 0;
}

.modal__footer--compact > :deep(*) {
  flex: 1;
}

@media (prefers-reduced-motion: reduce) {
  .modal__close {
    transition: none;
  }
}
</style>
