<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: {
    type: Number,
    required: true,
  },
  max: {
    type: Number,
    default: 100,
  },
  // info(파랑) · warning(노랑) · danger(빨강) · gold · brown · sand
  tone: {
    type: String,
    default: 'info',
  },
  width: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    default: '',
  },
})

const percentage = computed(() => {
  if (!props.max) return 0
  return Math.min(100, Math.max(0, (props.value / props.max) * 100))
})
</script>

<template>
  <div
    class="progress-bar"
    :style="width ? { width } : undefined"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="max"
    :aria-label="label || undefined"
  >
    <span class="progress-bar__fill" :class="`progress-bar__fill--${tone}`" :style="{ width: `${percentage}%` }" />
  </div>
</template>

<style scoped>
.progress-bar {
  overflow: hidden;
  width: 100%;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--color-cream-strong);
}

.progress-bar__fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  transition: width 240ms ease;
}

.progress-bar__fill--info {
  background: var(--color-info);
}

.progress-bar__fill--warning {
  background: var(--color-warning);
}

.progress-bar__fill--danger {
  background: var(--color-danger);
}

.progress-bar__fill--gold {
  background: var(--color-gold);
}

.progress-bar__fill--brown {
  background: var(--color-brown);
}

.progress-bar__fill--sand {
  background: #e8c9aa;
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar__fill {
    transition: none;
  }
}
</style>
