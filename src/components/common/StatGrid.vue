<script setup>
import StatCard from './StatCard.vue'

// 목록 화면 위쪽 요약 카드 줄. { id, label, value, hint, tone } 배열을 받습니다.
defineProps({
  stats: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <div class="stat-grid">
    <StatCard
      v-for="stat in stats"
      :key="stat.id"
      :label="stat.label"
      :value="stat.value"
      :hint="stat.hint"
      :tone="stat.tone ?? 'default'"
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

@media (max-width: 1180px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
