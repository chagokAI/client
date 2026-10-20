<script setup>
defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [String, Number],
    required: true,
  },
  // 수치 아래 보조 설명. (예: '8개 규격 운영 중')
  hint: {
    type: String,
    default: '',
  },
  // 값이 경고를 뜻할 때 빨간색으로 표시합니다. (예: 재고 부족 규격 2개)
  tone: {
    type: String,
    default: 'default',
  },
})
</script>

<template>
  <article class="stat-card">
    <p class="stat-card__label">{{ label }}</p>
    <p class="stat-card__value" :class="`stat-card__value--${tone}`">{{ value }}</p>
    <p v-if="hint || $slots.hint" class="stat-card__hint">
      <slot name="hint">{{ hint }}</slot>
    </p>
  </article>
</template>

<style scoped>
.stat-card {
  padding: 18px 20px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
  box-shadow: var(--shadow-card);
}

.stat-card__label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.stat-card__value {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.8px;
}

.stat-card__value--danger {
  color: var(--color-danger);
}

.stat-card__hint {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
}
</style>
