<script setup>
defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  placeholder: {
    type: String,
    default: '검색어를 입력하세요',
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
  <input
    class="search-input"
    :style="width ? { width } : undefined"
    type="search"
    :value="modelValue"
    :placeholder="placeholder"
    :aria-label="ariaLabel || placeholder"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>

<style scoped>
.search-input {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.search-input::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.search-input:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.search-input::-webkit-search-cancel-button {
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .search-input {
    transition: none;
  }
}
</style>
