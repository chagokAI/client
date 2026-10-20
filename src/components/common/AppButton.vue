<script setup>
defineProps({
  // primary: 갈색 채움 · secondary: 테두리 · danger: 빨강 채움 · danger-outline: 빨강 테두리 · ghost: 배경 없음
  variant: {
    type: String,
    default: 'secondary',
  },
  size: {
    type: String,
    default: 'md',
  },
  type: {
    type: String,
    default: 'button',
  },
  block: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <button
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`, { 'app-button--block': block }]"
    :type="type"
  >
    <slot />
  </button>
</template>

<style scoped>
.app-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 160ms ease, border-color 160ms ease, color 160ms ease;
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.app-button--block {
  width: 100%;
}

.app-button--sm {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}

.app-button--md {
  height: 38px;
  padding: 0 16px;
  font-size: 13px;
}

.app-button--lg {
  height: 48px;
  padding: 0 24px;
  font-size: 15px;
}

.app-button--primary {
  background: var(--color-brown);
  color: var(--color-white);
}

.app-button--primary:hover:not(:disabled) {
  background: var(--color-brown-dark);
}

.app-button--primary:active:not(:disabled) {
  background: var(--color-brown-darker);
}

.app-button--secondary {
  border-color: var(--color-card-border);
  background: var(--color-white);
  color: var(--color-text);
}

.app-button--secondary:hover:not(:disabled) {
  border-color: var(--color-border);
  background: var(--color-cream);
}

.app-button--danger {
  background: var(--color-danger);
  color: var(--color-white);
}

.app-button--danger:hover:not(:disabled) {
  background: #c92a2a;
}

.app-button--danger-outline {
  border-color: #f3c6c6;
  background: var(--color-white);
  color: var(--color-danger-text);
}

.app-button--danger-outline:hover:not(:disabled) {
  border-color: var(--color-danger);
  background: var(--color-danger-bg);
}

.app-button--ghost {
  background: transparent;
  color: var(--color-text-secondary);
}

.app-button--ghost:hover:not(:disabled) {
  background: var(--color-cream);
  color: var(--color-text);
}

@media (prefers-reduced-motion: reduce) {
  .app-button {
    transition: none;
  }
}
</style>
