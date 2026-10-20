<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Number,
    required: true,
  },
  // 발주 수량은 100개 단위로 조정합니다.
  step: {
    type: Number,
    default: 100,
  },
  min: {
    type: Number,
    default: 0,
  },
  max: {
    type: Number,
    default: Number.MAX_SAFE_INTEGER,
  },
  ariaLabel: {
    type: String,
    default: '수량',
  },
})

const emit = defineEmits(['update:modelValue'])

const formattedValue = computed(() => props.modelValue.toLocaleString('ko-KR'))

function clamp(value) {
  return Math.min(props.max, Math.max(props.min, value))
}

function change(delta) {
  emit('update:modelValue', clamp(props.modelValue + delta))
}

function handleInput(event) {
  const parsed = Number(event.target.value.replace(/[^\d]/g, ''))
  emit('update:modelValue', clamp(Number.isNaN(parsed) ? props.min : parsed))
}
</script>

<template>
  <div class="quantity-stepper">
    <button
      class="quantity-stepper__button"
      type="button"
      :disabled="modelValue <= min"
      :aria-label="`${ariaLabel} ${step}개 줄이기`"
      @click="change(-step)"
    >
      −
    </button>
    <input
      class="quantity-stepper__input"
      type="text"
      inputmode="numeric"
      :value="formattedValue"
      :aria-label="ariaLabel"
      @change="handleInput"
    />
    <button
      class="quantity-stepper__button"
      type="button"
      :disabled="modelValue >= max"
      :aria-label="`${ariaLabel} ${step}개 늘리기`"
      @click="change(step)"
    >
      +
    </button>
  </div>
</template>

<style scoped>
.quantity-stepper {
  display: inline-flex;
  align-items: center;
  height: 32px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  overflow: hidden;
}

.quantity-stepper__button {
  width: 28px;
  height: 100%;
  flex: none;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 160ms ease;
}

.quantity-stepper__button:hover:not(:disabled) {
  background: var(--color-cream);
  color: var(--color-text);
}

.quantity-stepper__button:disabled {
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.quantity-stepper__input {
  width: 52px;
  min-width: 0;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  text-align: center;
}

.quantity-stepper__input:focus {
  outline: none;
  background: var(--color-cream);
}

@media (prefers-reduced-motion: reduce) {
  .quantity-stepper__button {
    transition: none;
  }
}
</style>
