<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: '',
  },
  // { value, label } 형태의 배열을 받습니다.
  options: {
    type: Array,
    default: () => [],
  },
  width: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  // 테두리 선에 얹어 보여 줄 이름. (예: '카테고리') DateField 의 label 과 같은 모양입니다.
  label: {
    type: String,
    default: '',
  },
})

defineEmits(['update:modelValue'])

// 테두리 라벨을 <label for>로 묶으려면 선택 상자에 id가 있어야 합니다.
const autoId = useId()
const selectId = computed(() => (props.label ? autoId : ''))
</script>

<template>
  <div class="select-field" :style="width ? { width } : undefined">
    <label v-if="label" class="select-field__label" :for="selectId">{{ label }}</label>
    <select
      :id="selectId || undefined"
      class="select-field__control"
      :value="modelValue"
      :aria-label="label ? undefined : ariaLabel || undefined"
      @change="$emit('update:modelValue', $event.target.value)"
    >
      <option v-for="option in options" :key="option.value" :value="option.value">
        {{ option.label }}
      </option>
    </select>
    <svg class="select-field__arrow" viewBox="0 0 10 6" fill="none" aria-hidden="true">
      <path d="M1 1 5 5l4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
</template>

<style scoped>
.select-field {
  position: relative;
  display: inline-flex;
  min-width: 0;
}

/* 라벨은 테두리 선 위에 걸쳐 앉습니다. 높이는 그대로 40px이라 같은 줄의 다른 입력과 가운데가 맞습니다. */
.select-field__label {
  position: absolute;
  top: -7px;
  left: 9px;
  padding: 0 4px;
  background: var(--color-white);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
}

.select-field__control {
  appearance: none;
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 32px 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.select-field__control:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.select-field__arrow {
  position: absolute;
  top: 50%;
  right: 13px;
  width: 10px;
  height: 6px;
  color: var(--color-text-muted);
  transform: translateY(-50%);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .select-field__control {
    transition: none;
  }
}
</style>
