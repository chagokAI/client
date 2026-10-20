<script setup>
defineProps({
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
})

defineEmits(['update:modelValue'])
</script>

<template>
  <div class="select-field" :style="width ? { width } : undefined">
    <select
      class="select-field__control"
      :value="modelValue"
      :aria-label="ariaLabel || undefined"
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
  transition: border-color 160ms ease, box-shadow 160ms ease;
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
