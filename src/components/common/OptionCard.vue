<script setup>
import ProgressBar from './ProgressBar.vue'

defineProps({
  // 라디오 그룹에서 이 카드가 나타내는 값
  value: {
    type: [String, Number],
    required: true,
  },
  modelValue: {
    type: [String, Number],
    default: '',
  },
  name: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  subtitle: {
    type: String,
    default: '',
  },
  // 제목 옆 라벨. (예: 'AI 추천', '직접 지정')
  badge: {
    type: String,
    default: '',
  },
  badgeTone: {
    type: String,
    default: 'neutral',
  },
  // 오른쪽에 비율 막대를 함께 보여 줄 때 사용합니다.
  rate: {
    type: Number,
    default: null,
  },
  rateTone: {
    type: String,
    default: 'info',
  },
})

defineEmits(['update:modelValue'])
</script>

<template>
  <label class="option-card" :class="{ 'option-card--selected': value === modelValue }">
    <input
      class="option-card__radio"
      type="radio"
      :name="name"
      :value="value"
      :checked="value === modelValue"
      @change="$emit('update:modelValue', value)"
    />

    <div class="option-card__text">
      <div class="option-card__title-row">
        <span class="option-card__title">{{ title }}</span>
        <span v-if="badge" class="option-card__badge" :class="`option-card__badge--${badgeTone}`">{{ badge }}</span>
      </div>
      <p v-if="subtitle" class="option-card__subtitle">{{ subtitle }}</p>
    </div>

    <div v-if="rate !== null" class="option-card__rate">
      <ProgressBar :value="rate" :tone="rateTone" :label="`${title} 포장공간비율`" />
      <span class="option-card__rate-value">{{ rate.toFixed(1) }}%</span>
    </div>
  </label>
</template>

<style scoped>
.option-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    background-color 160ms ease;
}

.option-card:hover {
  border-color: var(--color-border);
}

.option-card--selected {
  border-color: var(--color-brown);
  background: var(--color-cream);
}

.option-card__radio {
  appearance: none;
  display: grid;
  place-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  margin: 0;
  border: 1px solid var(--color-text-muted);
  border-radius: 50%;
  background: var(--color-white);
  cursor: pointer;
}

.option-card__radio:checked {
  border-color: var(--color-brown);
}

.option-card__radio:checked::after {
  content: '';
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--color-brown);
}

.option-card__text {
  flex: 1;
  min-width: 0;
}

.option-card__title-row {
  display: flex;
  align-items: center;
  gap: 7px;
}

.option-card__title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.option-card__badge {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.option-card__badge--gold {
  background: var(--color-cream-strong);
  color: var(--color-warning-text);
}

.option-card__badge--info {
  background: var(--color-info-bg);
  color: var(--color-info-text);
}

.option-card__badge--neutral {
  background: var(--color-neutral-bg);
  color: var(--color-neutral-text);
}

.option-card__subtitle {
  margin: 3px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
  word-break: keep-all;
}

.option-card__rate {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: none;
}

.option-card__rate :deep(.progress-bar) {
  width: 90px;
}

.option-card__rate-value {
  min-width: 46px;
  font-size: 13px;
  font-weight: 700;
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .option-card {
    transition: none;
  }
}
</style>
