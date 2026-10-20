<script setup>
defineProps({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  // 제목 줄 오른쪽 끝에 표시할 보조 문구. (예: '조회 기간 2026.08.01 – 2026.10.19')
  meta: {
    type: String,
    default: '',
  },
})
</script>

<template>
  <header class="page-header">
    <div class="page-header__text">
      <h1 class="page-header__title">{{ title }}</h1>
      <p v-if="description" class="page-header__description">{{ description }}</p>
    </div>

    <div v-if="meta || $slots.actions" class="page-header__aside">
      <span v-if="meta" class="page-header__meta">{{ meta }}</span>
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 24px;
}

.page-header__title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  letter-spacing: -0.7px;
}

.page-header__description {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.page-header__aside {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: none;
  padding-top: 6px;
}

.page-header__meta {
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .page-header {
    flex-direction: column;
    gap: 12px;
  }

  .page-header__aside {
    padding-top: 0;
  }
}
</style>
