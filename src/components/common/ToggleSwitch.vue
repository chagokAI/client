<script setup>
defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  // 스위치 오른쪽에 붙는 글자. 비우면 스위치만 보입니다.
  label: {
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
  <label class="toggle-switch">
    <input
      type="checkbox"
      :checked="modelValue"
      :aria-label="ariaLabel || label || undefined"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
    <span class="toggle-switch__track" aria-hidden="true"><span class="toggle-switch__thumb" /></span>
    <span v-if="label" class="toggle-switch__label">{{ label }}</span>
  </label>
</template>

<style scoped>
.toggle-switch {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  width: fit-content;
  cursor: pointer;
}

.toggle-switch input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}

.toggle-switch__track {
  display: inline-flex;
  align-items: center;
  width: 40px;
  height: 22px;
  flex: none;
  padding: 3px;
  border-radius: var(--radius-pill);
  background: #d5d9df;
  transition: background-color 160ms ease;
}

.toggle-switch__thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-white);
  transition: transform 160ms ease;
}

.toggle-switch input:checked + .toggle-switch__track {
  background: var(--color-brown);
}

.toggle-switch input:checked + .toggle-switch__track .toggle-switch__thumb {
  transform: translateX(18px);
}

.toggle-switch input:focus-visible + .toggle-switch__track {
  outline: 3px solid var(--color-gold);
  outline-offset: 2px;
}

.toggle-switch__label {
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .toggle-switch__track,
  .toggle-switch__thumb {
    transition: none;
  }
}
</style>
