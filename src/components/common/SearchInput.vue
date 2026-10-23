<script setup>
import { ref, watch } from 'vue'
import AppButton from './AppButton.vue'

const props = defineProps({
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

const emit = defineEmits(['update:modelValue'])

// 글자마다 조회하면 목록이 계속 다시 그려지므로, 입력 중에는 화면 안에만 들고 있다가
// 엔터 · [검색] · 입력창의 지우기(x)에서 한 번만 올려 보냅니다.
const draft = ref(props.modelValue)

watch(
  () => props.modelValue,
  (value) => {
    draft.value = value
  },
)

function commit() {
  if (draft.value !== props.modelValue) emit('update:modelValue', draft.value)
}
</script>

<template>
  <div class="search-input">
    <input
      v-model="draft"
      class="search-input__control"
      :style="width ? { width } : undefined"
      type="search"
      :placeholder="placeholder"
      :aria-label="ariaLabel || placeholder"
      @keydown.enter.prevent="commit"
      @search="commit"
    />
    <AppButton class="search-input__button" variant="primary" @click="commit">검색</AppButton>
  </div>
</template>

<style scoped>
.search-input {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.search-input__control {
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

.search-input__control::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.search-input__control:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.search-input__control::-webkit-search-cancel-button {
  cursor: pointer;
}

/* 같은 줄의 입력들과 높이를 맞춥니다. */
.search-input__button {
  flex: none;
  height: 40px;
}

@media (prefers-reduced-motion: reduce) {
  .search-input__control {
    transition: none;
  }
}
</style>
