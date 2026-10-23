<script setup>
defineProps({
  // 단계 라벨 배열. 예: ['제안서 생성', '발주서 작성', '승인 완료', ...]
  steps: {
    type: Array,
    required: true,
  },
  // 현재 진행 중인 단계의 인덱스(0부터). 이전 단계는 완료로 표시됩니다.
  currentIndex: {
    type: Number,
    required: true,
  },
})
</script>

<template>
  <ol class="step-progress">
    <li
      v-for="(step, index) in steps"
      :key="step"
      class="step-progress__step"
      :class="{
        'step-progress__step--done': index < currentIndex,
        'step-progress__step--current': index === currentIndex,
      }"
      :aria-current="index === currentIndex ? 'step' : undefined"
    >
      <span class="step-progress__marker" aria-hidden="true">
        <svg v-if="index < currentIndex" viewBox="0 0 12 12" fill="none">
          <path
            d="m3 6.2 2 2L9 4"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <template v-else>{{ index + 1 }}</template>
      </span>
      <span class="step-progress__label">{{ step }}</span>
    </li>
  </ol>
</template>

<style scoped>
.step-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step-progress__step {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
}

/* 마지막 단계만 제자리에 두고, 앞 단계들이 남은 가로 폭을 나눠 가져 전체를 꽉 채웁니다. */
.step-progress__step:not(:last-child) {
  flex: 1;
}

/* 단계 사이를 잇는 선. 늘어나는 폭은 이 선이 받습니다. */
.step-progress__step:not(:last-child)::after {
  content: '';
  flex: 1;
  min-width: 16px;
  height: 1px;
  margin-left: 4px;
  background: var(--color-card-border);
}

.step-progress__step--done:not(:last-child)::after {
  background: var(--color-navy);
}

.step-progress__marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  border-radius: 50%;
  background: var(--color-neutral-bg);
  color: var(--color-neutral-text);
  font-size: 10px;
  font-weight: 700;
}

.step-progress__marker svg {
  width: 12px;
  height: 12px;
}

.step-progress__step--done .step-progress__marker {
  background: var(--color-navy);
  color: var(--color-white);
}

.step-progress__step--done .step-progress__label {
  color: var(--color-text);
}

.step-progress__step--current .step-progress__marker {
  background: var(--color-gold);
  color: var(--color-white);
}

.step-progress__step--current .step-progress__label {
  color: var(--color-text);
  font-weight: 700;
}
</style>
