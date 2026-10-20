<script setup>
defineProps({
  title: {
    type: String,
    default: '',
  },
  // 제목 오른쪽에 보조 정보를 표시할 때 사용합니다. (예: '기준 10.19 15:00')
  meta: {
    type: String,
    default: '',
  },
  padded: {
    type: Boolean,
    default: true,
  },
})
</script>

<template>
  <section class="app-card">
    <header v-if="title || $slots.header || $slots.actions" class="app-card__header">
      <div class="app-card__title-group">
        <h2 v-if="title" class="app-card__title">{{ title }}</h2>
        <slot name="header" />
      </div>
      <div v-if="meta || $slots.actions" class="app-card__actions">
        <span v-if="meta" class="app-card__meta">{{ meta }}</span>
        <slot name="actions" />
      </div>
    </header>

    <div class="app-card__body" :class="{ 'app-card__body--padded': padded }">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.app-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
  box-shadow: var(--shadow-card);
}

.app-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px 0;
}

.app-card__title-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.app-card__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.app-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.app-card__meta {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.app-card__body {
  flex: 1;
  min-width: 0;
}

.app-card__body--padded {
  padding: 16px 24px 24px;
}
</style>
