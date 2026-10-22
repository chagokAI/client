<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  type: {
    type: String,
    default: 'text',
  },
  placeholder: {
    type: String,
    default: '',
  },
  // 입력 오른쪽에 회색으로 붙는 단위. (예: '개', 'g', '일분')
  suffix: {
    type: String,
    default: '',
  },
  // 읽기 전용 필드는 회색 배경으로 구분합니다.
  readonly: {
    type: Boolean,
    default: false,
  },
  id: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  // 세 자리마다 쉼표를 넣어 보여 줍니다. 값은 숫자로 유지됩니다.
  formatNumber: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['update:modelValue'])

const displayValue = computed(() => {
  if (!props.formatNumber) return props.modelValue
  const parsed = Number(props.modelValue)
  return Number.isFinite(parsed) ? parsed.toLocaleString('ko-KR') : props.modelValue
})

function handleInput(event) {
  if (!props.formatNumber) {
    emit('update:modelValue', event.target.value)
    return
  }
  const digits = event.target.value.replace(/[^\d]/g, '')
  emit('update:modelValue', digits ? Number(digits) : 0)
}
</script>

<template>
  <div class="text-input" :class="{ 'text-input--readonly': readonly }">
    <input
      :id="id || undefined"
      class="text-input__control"
      :type="formatNumber ? 'text' : type"
      :inputmode="formatNumber ? 'numeric' : undefined"
      :value="displayValue"
      :placeholder="placeholder"
      :readonly="readonly"
      :aria-label="ariaLabel || undefined"
      @input="handleInput"
    />
    <span v-if="suffix" class="text-input__suffix">{{ suffix }}</span>
  </div>
</template>

<style scoped>
.text-input {
  position: relative;
  display: flex;
  min-width: 0;
}

.text-input__control {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  appearance: textfield;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.text-input__control::-webkit-outer-spin-button,
.text-input__control::-webkit-inner-spin-button {
  appearance: none;
  margin: 0;
}

.text-input__control::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.text-input__control:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.text-input--readonly .text-input__control {
  background: #f7f8f9;
  color: var(--color-text-secondary);
  cursor: default;
}

.text-input--readonly .text-input__control:focus {
  box-shadow: none;
}

.text-input:has(.text-input__suffix) .text-input__control {
  padding-right: 42px;
}

.text-input__suffix {
  position: absolute;
  top: 50%;
  right: 13px;
  color: var(--color-text-muted);
  font-size: 12px;
  transform: translateY(-50%);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .text-input__control {
    transition: none;
  }
}
</style>
