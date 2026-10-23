<script setup>
import StatCard from './StatCard.vue'

// 목록 화면 위쪽 요약 카드 줄. { id, label, value, hint, tone } 배열을 받습니다.
defineProps({
  stats: {
    type: Array,
    required: true,
  },
  // 카드를 따로 띄우지 않고 구분선으로 나눈 한 띠로 보여 줍니다.
  band: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <div class="stat-grid" :class="{ 'stat-grid--band': band }">
    <StatCard
      v-for="stat in stats"
      :key="stat.id"
      :label="stat.label"
      :value="stat.value"
      :hint="stat.hint"
      :tone="stat.tone ?? 'default'"
      :flush="band"
    />
  </div>
</template>

<style scoped>
.stat-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 20px;
}

/* 네 장을 한 장으로: 테두리·그림자 없이 옅은 크림 바탕만 깔고 사이 구분선만 남깁니다. */
.stat-grid--band {
  gap: 0;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--color-cream-soft);
}

.stat-grid--band > * + * {
  border-left: 1px solid var(--color-card-border);
}

@media (max-width: 1180px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  /* 2열로 접히면 줄이 바뀌는 자리의 세로선을 지우고 가로선으로 바꿉니다. */
  .stat-grid--band > :nth-child(odd) {
    border-left: 0;
  }

  .stat-grid--band > :nth-child(n + 3) {
    border-top: 1px solid var(--color-card-border);
  }
}
</style>
