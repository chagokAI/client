<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  // { value, label, count } 형태의 배열. count가 있으면 라벨 뒤에 붙습니다.
  options: {
    type: Array,
    default: () => [],
  },
  ariaLabel: {
    type: String,
    default: '필터',
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="filter-chips" role="group" :aria-label="ariaLabel">
    <button
      v-for="option in options"
      :key="option.value"
      class="filter-chips__chip"
      :class="{ 'filter-chips__chip--active': option.value === modelValue }"
      type="button"
      :aria-pressed="option.value === modelValue"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
      <span v-if="option.count !== undefined" class="filter-chips__count">{{ option.count }}</span>
    </button>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-chips__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 30px;
  padding: 0 13px;
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  background: var(--color-cream);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.filter-chips__chip:hover:not(.filter-chips__chip--active) {
  background: var(--color-cream-strong);
  color: var(--color-text);
}

.filter-chips__chip--active {
  background: var(--color-brown);
  color: var(--color-white);
  font-weight: 600;
}

@media (prefers-reduced-motion: reduce) {
  .filter-chips__chip {
    transition: none;
  }
}
</style>
