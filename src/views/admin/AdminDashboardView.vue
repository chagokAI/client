<script setup>
import AppCard from '@/components/common/AppCard.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'

// TODO: 아래 두 목록은 레이아웃 확인용 예시입니다. 센터 통합 지표 API가 준비되면 교체합니다.
// 매출: 센터별로 '무엇이 얼마나 좋아졌는지'를 한 줄씩 보여 줍니다.
const performances = [
  { id: 'cost', center: '동탄 센터', metric: '박스 비용', change: '−12.4%', note: '전월 대비 · 규격 교체 반영' },
  { id: 'throughput', center: '동탄 센터', metric: '시간당 처리량', change: '+8.2%', note: '최근 4주 평균' },
  { id: 'fill', center: '김포 센터', metric: '평균 포장공간비율', change: '+5.1%p', note: '매칭 규격 조정 후' },
  { id: 'waste', center: '양산 센터', metric: '완충재 사용량', change: '−18.0%', note: '전월 대비' },
]

// 문제 현황: 센터장이 바로 조치해야 하는 항목만 모읍니다.
const issues = [
  { id: 'shortage', center: '김포 센터', title: '3호 규격 재고 부족', detail: '안전 재고 165개 미만', label: '부족' },
  { id: 'unmatched', center: '양산 센터', title: '미매칭 상품 12건', detail: '치수 미등록 8건 포함', label: '미매칭' },
  {
    id: 'review',
    center: '동탄 센터',
    title: '포장공간비율 30% 미만 5건',
    detail: '규격 재검토 필요',
    label: '검토 필요',
  },
]
</script>

<template>
  <div class="admin-dashboard">
    <PageHeader
      title="실시간 센터 현황 (관리자)"
      description="전체 센터의 운영 성과와 조치가 필요한 항목을 한곳에서 확인합니다."
    />

    <div class="admin-dashboard__columns">
      <AppCard class="admin-dashboard__map" title="센터 위치" :padded="false">
        <div class="map-placeholder">
          <p class="map-placeholder__title">지도를 준비하고 있어요.</p>
          <p class="map-placeholder__text">센터 위치와 센터별 상태를 지도 위에 표시할 예정입니다.</p>
        </div>
      </AppCard>

      <div class="admin-dashboard__side">
        <AppCard title="매출">
          <ul class="performance">
            <li v-for="item in performances" :key="item.id" class="performance__item">
              <div class="performance__text">
                <p class="performance__metric">
                  <span class="performance__center">{{ item.center }}</span>
                  {{ item.metric }}
                </p>
                <p class="performance__note">{{ item.note }}</p>
              </div>
              <strong class="performance__change">{{ item.change }}</strong>
            </li>
          </ul>
        </AppCard>

        <AppCard title="문제 현황">
          <ul class="issue">
            <li v-for="item in issues" :key="item.id" class="issue__item">
              <div class="issue__text">
                <p class="issue__title">{{ item.title }}</p>
                <p class="issue__detail">{{ item.center }} · {{ item.detail }}</p>
              </div>
              <StatusBadge :label="item.label" />
            </li>
          </ul>
        </AppCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 왼쪽 지도, 오른쪽 매출·문제 현황을 6:4로 나눕니다. */
.admin-dashboard__columns {
  display: grid;
  gap: 20px;
  grid-template-columns: 6fr 4fr;
  align-items: start;
}

/* 지도 카드는 오른쪽 두 카드를 합친 높이만큼 늘어납니다. */
.admin-dashboard__map {
  align-self: stretch;
  overflow: hidden;
}

.admin-dashboard__side {
  display: grid;
  gap: 20px;
}

/* 넓은 화면에서는 본문 여백(위 40 + 아래 72)을 뺀 높이에 맞춰 한 화면에 담습니다.
   좁은 화면은 1열로 쌓이므로 높이를 고정하지 않습니다. */
@media (min-width: 1181px) {
  .admin-dashboard {
    display: flex;
    flex-direction: column;
    height: calc(100svh - 112px);
  }

  .admin-dashboard__columns {
    flex: 1;
    min-height: 0;
    align-items: stretch;
  }

  /* 오른쪽 두 카드가 남은 높이를 나눠 갖고, 내용이 넘치면 카드 안에서만 스크롤됩니다. */
  .admin-dashboard__side {
    grid-template-rows: repeat(2, minmax(0, 1fr));
    min-height: 0;
  }

  .admin-dashboard__side > * {
    min-height: 0;
  }

  .admin-dashboard__side :deep(.app-card__body) {
    min-height: 0;
    overflow-y: auto;
  }
}

/* 지도가 들어올 자리. 실제 지도를 붙일 때 이 블록만 바꿉니다. */
.map-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 100%;
  min-height: 320px;
  background: var(--color-cream-soft);
  text-align: center;
}

.map-placeholder__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.map-placeholder__text {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: keep-all;
}

.performance,
.issue {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.performance__item,
.issue__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13px 16px;
  border-radius: var(--radius-md);
  background: var(--color-cream-soft);
}

.performance__text,
.issue__text {
  min-width: 0;
}

.performance__metric,
.issue__title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.performance__center {
  margin-right: 6px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.performance__note,
.issue__detail {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  word-break: keep-all;
}

.performance__change {
  flex: none;
  color: var(--color-success-text);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

@media (max-width: 1180px) {
  .admin-dashboard__columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
