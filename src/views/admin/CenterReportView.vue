<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
import CenterGuideCard from './report/CenterGuideCard.vue'
import HqReportCard from './report/HqReportCard.vue'
</script>

<template>
  <div class="center-report">
    <PageHeader title="센터별 리포트/지침서" />

    <!-- 리포트는 센터 카드·차트가 넓게 펼쳐지는 양식이라 위아래로 쌓아 전체 폭을 씁니다 -->
    <div class="center-report__stack">
      <HqReportCard />
      <CenterGuideCard />
    </div>
  </div>
</template>

<style scoped>
.center-report__stack {
  display: grid;
  gap: 20px;
}
</style>
