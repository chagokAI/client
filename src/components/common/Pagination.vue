<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: {
    type: Number,
    required: true,
  },
  totalPages: {
    type: Number,
    required: true,
  },
  // 앞뒤로 몇 개의 번호를 노출할지. 넘어가면 말줄임표로 접힙니다.
  siblingCount: {
    type: Number,
    default: 1,
  },
})

const emit = defineEmits(['update:modelValue'])

const pages = computed(() => {
  const { modelValue: current, totalPages: total, siblingCount } = props
  if (total <= 5 + siblingCount * 2) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const start = Math.max(2, current - siblingCount)
  const end = Math.min(total - 1, current + siblingCount)
  const items = [1]

  if (start > 2) items.push('start-ellipsis')
  for (let page = start; page <= end; page += 1) items.push(page)
  if (end < total - 1) items.push('end-ellipsis')
  items.push(total)

  return items
})

function goTo(page) {
  if (page < 1 || page > props.totalPages || page === props.modelValue) return
  emit('update:modelValue', page)
}
</script>

<template>
  <nav class="pagination" aria-label="페이지 이동">
    <button
      class="pagination__arrow"
      type="button"
      :disabled="modelValue <= 1"
      aria-label="이전 페이지"
      @click="goTo(modelValue - 1)"
    >
      ‹
    </button>

    <template v-for="page in pages" :key="page">
      <span v-if="typeof page === 'string'" class="pagination__ellipsis" aria-hidden="true">…</span>
      <button
        v-else
        class="pagination__page"
        :class="{ 'pagination__page--active': page === modelValue }"
        type="button"
        :aria-label="`${page}페이지`"
        :aria-current="page === modelValue ? 'page' : undefined"
        @click="goTo(page)"
      >
        {{ page }}
      </button>
    </template>

    <button
      class="pagination__arrow"
      type="button"
      :disabled="modelValue >= totalPages"
      aria-label="다음 페이지"
      @click="goTo(modelValue + 1)"
    >
      ›
    </button>
  </nav>
</template>

<style scoped>
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.pagination__page,
.pagination__arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 30px;
  height: 30px;
  padding: 0 6px;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.pagination__page:hover:not(.pagination__page--active),
.pagination__arrow:hover:not(:disabled) {
  background: var(--color-cream);
  color: var(--color-text);
}

.pagination__page--active {
  background: var(--color-brown);
  color: var(--color-white);
  font-weight: 600;
}

.pagination__arrow:disabled {
  color: #d5d9df;
  cursor: not-allowed;
}

.pagination__ellipsis {
  min-width: 24px;
  color: var(--color-text-muted);
  font-size: 13px;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .pagination__page,
  .pagination__arrow {
    transition: none;
  }
}
</style>
