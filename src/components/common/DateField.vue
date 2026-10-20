<script setup>
import { computed } from 'vue'

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
  // 입력 오른쪽에 요일을 함께 보여 줍니다. (예: '(화)')
  showWeekday: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:modelValue'])

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const weekday = computed(() => {
  if (!props.modelValue) return ''
  const date = new Date(`${props.modelValue}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '' : `(${WEEKDAYS[date.getDay()]})`
})
</script>

<template>
  <div class="date-field">
    <input
      :id="id || undefined"
      class="date-field__control"
      type="date"
      :value="modelValue"
      :min="min || undefined"
      :max="max || undefined"
      :aria-label="ariaLabel || undefined"
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
  transition: border-color 160ms ease, box-shadow 160ms ease;
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
