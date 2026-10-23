<script setup>
import PageHeader from '@/components/common/PageHeader.vue'
</script>

<template>
  <div class="admin-dashboard">
    <PageHeader
      title="실시간 센터 현황 (관리자)"
      description="전체 센터의 재고와 포장 공정을 한곳에서 비교해 확인합니다."
    />

    <div class="empty-state">
      <p class="empty-state__title">화면을 준비하고 있어요.</p>
      <p class="empty-state__text">센터별 현황을 모아 보여 줄 예정입니다.</p>
    </div>
  </div>
</template>
