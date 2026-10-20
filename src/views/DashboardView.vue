<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { dashboardModel } from '@/api/adapters'
import { useRemote } from '@/composables/useRemote'
import ApiState from '@/components/common/ApiState.vue'

const { loading, error, load } = useRemote()
const result = ref(null)
const model = computed(() => dashboardModel(result.value))
const forecast = computed(() => model.value.forecast)
const inventorySummary = computed(() => model.value.inventorySummary)
const costSummary = computed(() => model.value.costSummary)
const safetyStockAlerts = computed(() => model.value.safetyStockAlerts)
function refresh() { return load(signal => warehouseApi('/dashboard', { signal }), value => { result.value = value.data }) }
onMounted(refresh)

const router = useRouter()

// 규격별 재고 막대는 가장 큰 값 기준으로 비율을 잡습니다.
const inventoryTotal = computed(() => inventorySummary.bySize.reduce((sum, item) => sum + item.ratio, 0))

function goToOrder() {
  router.push('/orders')
}
</script>

<template>
  <div class="dashboard">
    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <AppButton :disabled="loading" @click="refresh">새로고침</AppButton>
    <h1 class="dashboard__greeting">안녕하세요, {{ auth.session.value?.warehouse?.name }}님</h1>

    <div class="dashboard__top">
      <AppCard class="dashboard__simulation" :padded="false">
        <template #header>
          <div class="simulation__heading">
            <div class="simulation__title-row">
              <h2 class="simulation__title">시뮬레이션</h2>
              <span class="simulation__live"><span class="simulation__live-dot" />준비 중</span>
            </div>
            <p class="simulation__description">창고 적재와 포장 공정을 가상 공간에 재현해 박스 배치를 미리 확인합니다.</p>
          </div>
        </template>

        <template #actions>
          <AppButton variant="secondary">전체 화면</AppButton>
        </template>

        <div class="simulation__viewport">
          <!-- TODO: 3D 시뮬레이션 뷰어를 이 영역에 마운트합니다. -->
          <p class="simulation__placeholder">시뮬레이션 뷰어 연결 예정</p>
        </div>
      </AppCard>

      <AppCard class="dashboard__forecast">
        <template #header>
          <div class="forecast__title-row">
            <h2 class="forecast__title">박스 예상 예측량</h2>
            <span class="forecast__period">{{ forecast.period }}</span>
          </div>
        </template>

        <p class="forecast__basis">{{ forecast.basis }}</p>

        <p class="forecast__total">{{ forecast.total }}</p>
        <p class="forecast__comparison">
          {{ forecast.comparison }}
          <strong class="forecast__change">{{ forecast.change }}</strong>
        </p>

        <ul class="forecast__breakdown">
          <li v-for="item in forecast.breakdown" :key="item.id" class="forecast__breakdown-item">
            <div class="forecast__breakdown-row">
              <span class="forecast__breakdown-label">{{ item.label }}</span>
              <span class="forecast__breakdown-value">{{ item.quantity }} · {{ item.ratio }}%</span>
            </div>
            <ProgressBar :value="item.ratio" :max="50" :tone="item.tone" :label="item.label" />
          </li>
        </ul>

        <section class="insight">
          <h3 class="insight__title">분석 안내</h3>
          <ul class="insight__list">
            <li v-for="insight in forecast.insights" :key="insight">{{ insight }}</li>
          </ul>
        </section>

        <AppButton class="forecast__cta" variant="secondary" block @click="goToOrder">
          박스 주문 제안서 보기
        </AppButton>
      </AppCard>
    </div>

    <div class="dashboard__bottom">
      <AppCard title="재고 현황" :meta="inventorySummary.asOf">
        <div class="inventory__columns">
          <div v-for="column in [inventorySummary.current, inventorySummary.next]" :key="column.label">
            <p class="inventory__label">{{ column.label }}</p>
            <p class="inventory__value">{{ column.value }}</p>
            <p class="inventory__hint">{{ column.hint }}</p>
          </div>
        </div>

        <div class="inventory__by-size">
          <div class="inventory__by-size-head">
            <span class="inventory__by-size-title">규격별 재고</span>
            <span class="inventory__shortage">{{ inventorySummary.shortageNote }}</span>
          </div>

          <div class="inventory__stack" role="img" aria-label="규격별 재고 비율">
            <span
              v-for="item in inventorySummary.bySize"
              :key="item.id"
              class="inventory__stack-segment"
              :class="`inventory__stack-segment--${item.tone}`"
              :style="{ width: `${inventoryTotal ? (item.ratio / inventoryTotal) * 100 : 0}%` }"
            />
          </div>

          <ul class="inventory__legend">
            <li v-for="item in inventorySummary.bySize" :key="item.id" class="inventory__legend-item">
              <span class="inventory__legend-dot" :class="`inventory__legend-dot--${item.tone}`" />
              {{ item.label }}
              <strong>{{ item.quantity }}</strong>
            </li>
          </ul>
        </div>
      </AppCard>

      <AppCard title="비용 · 절감" :meta="costSummary.note">
        <ul class="cost__list">
          <li v-for="item in costSummary.items" :key="item.id" class="cost__item">
            <div class="cost__text">
              <p class="cost__label">{{ item.label }}</p>
              <p class="cost__hint" :class="`cost__hint--${item.hintTone}`">{{ item.hint }}</p>
            </div>
            <p class="cost__value" :class="`cost__value--${item.valueTone}`">{{ item.value }}</p>
          </li>
        </ul>
      </AppCard>

      <AppCard title="안전 재고 부족">
        <template #actions>
          <span class="shortage__count">{{ safetyStockAlerts.count }}</span>
        </template>

        <ul class="shortage__list">
          <li v-for="item in safetyStockAlerts.items" :key="item.id" class="shortage__item">
            <div class="shortage__row">
              <span class="shortage__code">
                <strong>{{ item.code }}</strong>
                <span class="shortage__name">{{ item.name }}</span>
              </span>
              <span class="shortage__amount">{{ item.shortage }}</span>
            </div>
            <ProgressBar :value="item.ratio" tone="danger" :label="`${item.code} 재고 수준`" />
            <p class="shortage__detail">{{ item.detail }}</p>
          </li>
        </ul>

        <button class="shortage__link" type="button" @click="goToOrder">
          박스 주문 제안서에서 발주하기 <span aria-hidden="true">→</span>
        </button>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard__greeting {
  margin: 0 0 20px;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.4px;
}

.dashboard__top {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1.9fr) minmax(360px, 1fr);
  margin-bottom: 20px;
}

.dashboard__bottom {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* 시뮬레이션 */
.simulation__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.simulation__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.simulation__live {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--color-navy);
  color: var(--color-white);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.simulation__live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
}

.simulation__description {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.simulation__viewport {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 880 / 480;
  margin: 16px 20px 20px;
  border-radius: var(--radius-md);
  background: #0e1118;
}

.simulation__placeholder {
  margin: 0;
  color: #5b6472;
  font-size: 13px;
}

/* 예측량 */
.forecast__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.forecast__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.forecast__period {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--color-neutral-bg);
  color: var(--color-neutral-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.forecast__basis {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.forecast__total {
  margin: 14px 0 0;
  font-size: 34px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -1.2px;
}

.forecast__comparison {
  margin: 4px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.forecast__change {
  color: var(--color-info);
  font-weight: 600;
}

.forecast__breakdown {
  display: grid;
  gap: 14px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.forecast__breakdown-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 7px;
}

.forecast__breakdown-label {
  font-size: 13px;
  font-weight: 500;
}

.forecast__breakdown-value {
  font-size: 13px;
  font-weight: 600;
}

.insight {
  margin-top: 20px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
}

.insight__title {
  margin: 0 0 8px;
  color: var(--color-brown);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.insight__list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 14px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.insight__list li {
  word-break: keep-all;
}

.forecast__cta {
  margin-top: 20px;
}

/* 재고 현황 */
.inventory__columns {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding-bottom: 18px;
  border-bottom: 1px solid var(--color-divider);
}

.inventory__label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.inventory__value {
  margin: 6px 0 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.8px;
}

.inventory__hint {
  margin: 6px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.45;
  word-break: keep-all;
}

.inventory__by-size {
  padding-top: 18px;
}

.inventory__by-size-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.inventory__by-size-title {
  font-size: 13px;
  font-weight: 600;
}

.inventory__shortage {
  color: var(--color-danger-text);
  font-size: 11px;
  font-weight: 600;
}

.inventory__stack {
  display: flex;
  overflow: hidden;
  height: 8px;
  border-radius: var(--radius-pill);
  background: var(--color-cream-strong);
}

.inventory__stack-segment--gold {
  background: var(--color-gold);
}

.inventory__stack-segment--brown {
  background: var(--color-brown);
}

.inventory__stack-segment--sand {
  background: #e8c9aa;
}

.inventory__legend {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
  margin: 12px 0 0;
  padding: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  list-style: none;
}

.inventory__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.inventory__legend-item strong {
  color: var(--color-text);
}

.inventory__legend-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.inventory__legend-dot--gold {
  background: var(--color-gold);
}

.inventory__legend-dot--brown {
  background: var(--color-brown);
}

.inventory__legend-dot--sand {
  background: #e8c9aa;
}

/* 비용 · 절감 */
.cost__list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cost__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 0;
  border-bottom: 1px solid var(--color-divider);
}

.cost__item:first-child {
  padding-top: 0;
}

.cost__item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.cost__label {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  word-break: keep-all;
}

.cost__hint {
  margin: 3px 0 0;
  font-size: 11px;
  line-height: 1.45;
}

.cost__hint--success {
  color: var(--color-success-text);
}

.cost__hint--info {
  color: var(--color-info);
}

.cost__hint--muted {
  color: var(--color-text-muted);
}

.cost__value {
  flex: none;
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.4px;
  white-space: nowrap;
}

.cost__value--info {
  color: var(--color-info);
}

/* 안전 재고 부족 */
.shortage__count {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.shortage__list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.shortage__item {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
}

.shortage__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

.shortage__code {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 13px;
}

.shortage__name {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.shortage__amount {
  color: var(--color-danger-text);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.shortage__detail {
  margin: 9px 0 0;
  color: var(--color-text-secondary);
  font-size: 11px;
  line-height: 1.45;
}

.shortage__link {
  margin-top: 16px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.shortage__link:hover {
  color: var(--color-brown);
  text-decoration: underline;
}

@media (max-width: 1180px) {
  .dashboard__top {
    grid-template-columns: minmax(0, 1fr);
  }

  .dashboard__bottom {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
