<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { warehouseApi } from '@/stores/auth'
import { dashboardModel } from '@/api/models'
import { ORDER, localDate, number, time } from '@/api/format'
import { orderRow } from '@/api/rows'
import { useRemote } from '@/composables/useRemote'
import ApiState from '@/components/common/ApiState.vue'
import DigitalTwinViewer from '@/components/dashboard/DigitalTwinViewer.vue'

const twin = ref(null)

const { loading, error, load } = useRemote()
const result = ref(null)
const model = computed(() => dashboardModel(result.value))
const forecast = computed(() => model.value.forecast)
const inventorySummary = computed(() => model.value.inventorySummary)
const costSummary = computed(() => model.value.costSummary)
const safetyStockAlerts = computed(() => model.value.safetyStockAlerts)

// 발주 현황은 발주서 이력과 같은 기준(최근 3개월)으로 상태별 건수와 최근 발주 3건을 보여 줍니다.
const today = localDate(),
  [year, month] = today.split('-').map(Number)
const orderFrom = localDate(new Date(Date.UTC(year, month - 3, 1, 12)))
const orderPage = ref(null)
const loadedAt = ref(null)
const orderStatus = computed(() =>
  ['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED'].map((status) => ({
    id: status,
    label: ORDER[status],
    count: `${number(orderPage.value?.counts?.[status] ?? 0)}건`,
  })),
)
const recentOrders = computed(() => (orderPage.value?.items ?? []).map(orderRow))

function refresh() {
  return load(
    (signal) =>
      Promise.all([
        warehouseApi('/dashboard', { signal }),
        warehouseApi('/purchase-orders', {
          signal,
          query: { from: orderFrom, to: today, page: 0, size: 3, sort: 'createdAt,desc' },
        }),
      ]),
    ([dashboard, orders]) => {
      result.value = dashboard.data
      orderPage.value = orders.data
      loadedAt.value = new Date()
    },
  )
}
onMounted(refresh)

const router = useRouter()

// 규격별 재고 막대는 가장 큰 값 기준으로 비율을 잡습니다.
const inventoryTotal = computed(() => inventorySummary.value.bySize.reduce((sum, item) => sum + item.ratio, 0))

function goToOrder() {
  router.push('/orders')
}

function goToOrderHistory() {
  router.push('/purchase-orders')
}
</script>

<template>
  <div class="dashboard">
    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <AppCard class="dashboard__simulation" :padded="false">
      <template #header>
        <div class="simulation__heading">
          <div class="simulation__title-row">
            <h2 class="simulation__title">실시간 센터 현황</h2>
            <span class="simulation__live"><span class="simulation__live-dot" />LIVE</span>
          </div>
        </div>
      </template>

      <template #actions>
        <AppButton variant="secondary" @click="twin?.toggleFullscreen()">전체 화면</AppButton>
      </template>

      <div class="simulation__viewport">
        <DigitalTwinViewer ref="twin" />
      </div>
    </AppCard>

    <div class="dashboard__toolbar">
      <h2 class="dashboard__section-title">
        센터 현황
        <span class="dashboard__loaded-at">{{ loadedAt ? `기준 ${time(loadedAt)}` : '' }}</span>
      </h2>
      <AppButton class="dashboard__refresh" :disabled="loading" aria-label="새로고침" title="새로고침" @click="refresh">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13 8a5 5 0 1 1-1.46-3.54M13 2.5v2.5h-2.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </AppButton>
    </div>

    <div class="dashboard__bottom">
      <AppCard :padded="false">
        <div class="status">
          <section class="status__section">
            <header class="status__head">
              <h2 class="status__title">재고 현황</h2>
              <span class="status__meta">{{ inventorySummary.asOf }}</span>
            </header>

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

            <div class="shortage">
              <div class="inventory__by-size-head">
                <span class="inventory__by-size-title">안전 재고 부족</span>
                <span class="shortage__count">{{ safetyStockAlerts.count }}</span>
              </div>

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
            </div>
          </section>

          <section class="status__section">
            <header class="status__head">
              <h2 class="status__title">발주 현황</h2>
              <span class="status__meta">최근 3개월</span>
            </header>

            <ul class="orders__counts">
              <li v-for="item in orderStatus" :key="item.id" class="orders__count">
                <StatusBadge :label="item.label" />
                <strong class="orders__count-value">{{ item.count }}</strong>
              </li>
            </ul>

            <div class="orders__recent">
              <span class="inventory__by-size-title">최근 발주</span>

              <ul v-if="recentOrders.length" class="orders__list">
                <li v-for="order in recentOrders" :key="order.id" class="orders__item">
                  <div class="orders__row">
                    <strong class="orders__number">{{ order.number }}</strong>
                    <StatusBadge :label="order.statusLabel" />
                  </div>
                  <p class="orders__detail">{{ order.supplier }} · {{ order.specs }}</p>
                  <div class="orders__row orders__row--meta">
                    <span>{{ order.orderedAt }} 발주 · {{ order.quantity }}</span>
                    <strong class="orders__amount">{{ order.amount }}</strong>
                  </div>
                </li>
              </ul>
              <p v-else class="orders__empty">최근 3개월 동안의 발주 내역이 없어요.</p>
            </div>

            <button class="shortage__link" type="button" @click="goToOrderHistory">
              발주서 이력 보기 <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
      </AppCard>

      <AppCard>
        <template #header>
          <div class="forecast__title-row">
            <h2 class="forecast__title">박스 예측량</h2>
            <span class="forecast__period">{{ forecast.period }}</span>
          </div>
        </template>

        <p class="forecast__basis">{{ forecast.basis }}</p>
        <p class="forecast__total">{{ forecast.total }}</p>

        <ul class="forecast__breakdown">
          <li v-for="item in forecast.breakdown" :key="item.id" class="forecast__breakdown-item">
            <div class="forecast__breakdown-row">
              <span class="forecast__breakdown-label">{{ item.label }}</span>
              <span class="forecast__breakdown-value">{{ item.quantity }} · {{ item.ratio }}%</span>
            </div>
            <ProgressBar :value="item.ratio" :max="100" :tone="item.tone" :label="item.label" />
          </li>
        </ul>

        <section class="cost">
          <div class="cost__head">
            <h3 class="cost__title">비용 · 절감</h3>
            <span class="status__meta">{{ costSummary.note }}</span>
          </div>

          <ul class="cost__list">
            <li v-for="item in costSummary.items" :key="item.id" class="cost__item">
              <div class="cost__text">
                <p class="cost__label">{{ item.label }}</p>
                <p class="cost__hint" :class="`cost__hint--${item.hintTone}`">{{ item.hint }}</p>
              </div>
              <p class="cost__value" :class="`cost__value--${item.valueTone}`">{{ item.value }}</p>
            </li>
          </ul>
        </section>

        <AppButton class="forecast__cta" variant="secondary" block @click="goToOrder">
          박스 주문 제안서 보기
        </AppButton>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
.dashboard__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}

.dashboard__section-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.dashboard__loaded-at {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
  letter-spacing: 0;
}

.dashboard__refresh {
  width: 38px;
  padding: 0;
}

.dashboard__refresh svg {
  width: 18px;
  height: 18px;
}

.dashboard__simulation {
  margin-bottom: 20px;
}

.dashboard__bottom {
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
}

/* 재고 · 발주 현황 (한 카드를 좌우로 나눕니다) */
.status {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  height: 100%;
}

.status__section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 20px 24px 24px;
}

.status__section + .status__section {
  border-left: 1px solid var(--color-divider);
}

.status__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.status__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.status__meta {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
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
  margin: 16px 20px 20px;
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
.cost {
  margin: 22px 0 20px;
  padding-top: 18px;
  border-top: 1px solid var(--color-divider);
}

.cost__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.cost__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

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
.shortage {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px solid var(--color-divider);
}

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

.status__section > .shortage__link {
  align-self: flex-start;
  margin-top: auto;
  padding-top: 16px;
}

/* 발주 현황 */
.orders__counts {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0 0 18px;
  border-bottom: 1px solid var(--color-divider);
  list-style: none;
}

.orders__count {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
}

.orders__count-value {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.orders__recent {
  padding-top: 18px;
}

.orders__list {
  display: grid;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.orders__item {
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
}

.orders__item:first-child {
  padding-top: 0;
}

.orders__item:last-child {
  border-bottom: 0;
}

.orders__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.orders__number {
  font-size: 13px;
}

.orders__detail {
  margin: 4px 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}

.orders__row--meta {
  color: var(--color-text-muted);
  font-size: 11px;
}

.orders__amount {
  color: var(--color-text);
  font-size: 13px;
  white-space: nowrap;
}

.orders__empty {
  margin: 10px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

@media (max-width: 1180px) {
  .dashboard__bottom {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 760px) {
  .status {
    grid-template-columns: minmax(0, 1fr);
  }

  .status__section + .status__section {
    border-top: 1px solid var(--color-divider);
    border-left: 0;
  }
}
</style>
