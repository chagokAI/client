<script setup>
import { computed, useId } from 'vue'

const props = defineProps({
  // yyyy-mm-dd 형식. 브라우저 기본 날짜 입력이 쓰는 형식입니다.
  modelValue: {
    type: String,
    default: '',
  },
  min: {
    type: String,
    default: '',
  },
  max: {
    type: String,
    default: '',
  },
  id: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
  // 입력 테두리 선에 얹어 보여 줄 이름. (예: '시작일시') 비우면 테두리만 그립니다.
  label: {
    type: String,
    default: '',
  },
  // 입력 오른쪽에 요일을 함께 보여 줍니다. (예: '(화)')
  showWeekday: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:modelValue'])

// 테두리 라벨을 <label for>로 묶으려면 입력에 id가 있어야 합니다.
const autoId = useId()
const inputId = computed(() => props.id || (props.label ? autoId : ''))

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const weekday = computed(() => {
  if (!props.modelValue) return ''
  const date = new Date(`${props.modelValue}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '' : `(${WEEKDAYS[date.getDay()]})`
})
</script>

<template>
  <div class="date-field" :class="{ 'date-field--labeled': label }">
    <label v-if="label" class="date-field__label" :for="inputId">{{ label }}</label>
    <input
      :id="inputId || undefined"
      class="date-field__control"
      type="date"
      :value="modelValue"
      :min="min || undefined"
      :max="max || undefined"
      :aria-label="label ? undefined : ariaLabel || undefined"
      @input="$emit('update:modelValue', $event.target.value)"
    />
    <span v-if="showWeekday && weekday" class="date-field__weekday">{{ weekday }}</span>
  </div>
</template>

<style scoped>
.date-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* 라벨은 테두리 선 위에 걸쳐 앉습니다. 입력 높이는 그대로 40px이라
   같은 줄의 다른 입력과 가운데가 맞습니다. */
.date-field--labeled {
  position: relative;
}

.date-field__label {
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

.date-field__control {
  flex: 1;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.date-field__control:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

/* 브라우저가 그리는 달력 아이콘을 본문 색에 맞춥니다. */
.date-field__control::-webkit-calendar-picker-indicator {
  opacity: 0.55;
  cursor: pointer;
}

.date-field__control::-webkit-calendar-picker-indicator:hover {
  opacity: 0.9;
}

.date-field__weekday {
  flex: none;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .date-field__control {
    transition: none;
  }
}
</style>
