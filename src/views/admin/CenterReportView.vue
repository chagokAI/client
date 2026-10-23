<script setup>
import AppCard from '@/components/common/AppCard.vue'
import PageHeader from '@/components/common/PageHeader.vue'
</script>

<template>
  <div class="center-report">
    <PageHeader
      title="센터별 리포트/지침서"
      description="센터별 운영 리포트와 박스 운용 지침서를 확인하고 내려받습니다."
    />

    <div class="center-report__columns">
      <AppCard title="센터별 리포트">
        <div class="empty-state">
          <p class="empty-state__title">화면을 준비하고 있어요.</p>
          <p class="empty-state__text">센터별 운영 리포트가 들어갈 자리입니다.</p>
        </div>
      </AppCard>

      <AppCard title="지침서">
        <div class="empty-state">
          <p class="empty-state__title">화면을 준비하고 있어요.</p>
          <p class="empty-state__text">박스 운용 지침서가 들어갈 자리입니다.</p>
        </div>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
.center-report__columns {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

@media (max-width: 1180px) {
  .center-report__columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
