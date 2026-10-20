<script setup>
import { useId } from 'vue'

defineProps({
  label: {
    type: String,
    default: '',
  },
  required: {
    type: Boolean,
    default: false,
  },
  // 입력 아래에 붙는 설명. (예: '일 평균 소모량 기준으로 자동 계산')
  hint: {
    type: String,
    default: '',
  },
})

// label과 입력을 묶기 위한 id. 슬롯에서 받아 씁니다.
const fieldId = useId()
</script>

<template>
  <div class="form-field">
    <label v-if="label" class="form-field__label" :for="fieldId">
      {{ label }}
      <span v-if="required" class="form-field__required" aria-hidden="true">*</span>
    </label>

    <slot :field-id="fieldId" />

    <p v-if="hint || $slots.hint" class="form-field__hint">
      <slot name="hint">{{ hint }}</slot>
    </p>
  </div>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 6px;
  min-width: 0;
  align-content: start;
}

.form-field__label {
  color: var(--color-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.5;
}

.form-field__required {
  color: var(--color-gold);
}

.form-field__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  word-break: keep-all;
}
</style>
