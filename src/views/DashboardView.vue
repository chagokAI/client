<script setup>
import { computed, onMounted, ref } from 'vue'
import AppCard from '@/components/common/AppCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import ApiState from '@/components/common/ApiState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import LiveTwinPanel from '@/components/dashboard/LiveTwinPanel.vue'
import { warehouseApi } from '@/stores/auth'
import { ORDER, currency, localDate, number, time } from '@/api/format'
import { orderRow } from '@/api/rows'
import { useRemote } from '@/composables/useRemote'

// 대시보드: ① 한눈에 보는 KPI → ② 규격별 재고 vs 예측과 비용·절감 → ③ 실시간 센터 현황과 최근 발주 순으로 배치합니다.
// 데이터는 /dashboard와 /purchase-orders(최근 3개월, 6건)를 함께 불러옵니다.
const { loading, error, load } = useRemote()
const data = ref(null)
const orders = ref(null)
const loadedAt = ref(null)

const today = localDate(),
  [year, month] = today.split('-').map(Number)
const orderFrom = localDate(new Date(Date.UTC(year, month - 3, 1, 12)))

function refresh() {
  return load(
    (signal) =>
      Promise.all([
        warehouseApi('/dashboard', { signal }),
        warehouseApi('/purchase-orders', {
          signal,
          query: { from: orderFrom, to: today, page: 0, size: 6, sort: 'createdAt,desc' },
        }),
      ]),
    ([dashboard, page]) => {
      data.value = dashboard.data
      orders.value = page.data
      loadedAt.value = new Date()
    },
  )
}
onMounted(refresh)

// 재고 여유(몇 개월분) = 현재 재고 ÷ 다음 달 예측 사용량. 1.5개월 미만은 부족 주의, 12개월 이상은 과잉으로 봅니다.
const LOW_MONTHS = 1.5
const HIGH_MONTHS = 12
const SIZE_LABEL = { S: 'S (소형)', M: 'M (중형)', L: 'L (대형)' }

const months = (stock, usage) => (usage > 0 && stock != null ? stock / usage : null)
const monthsText = (value) => (value == null ? '—' : `${value.toFixed(1)}개월분`)
const monthsTone = (value) =>
  value == null ? 'muted' : value < LOW_MONTHS ? 'warn' : value >= HIGH_MONTHS ? 'info' : 'ok'

const sizes = computed(() => {
  const stock = Object.fromEntries((data.value?.stockBySize ?? []).map((s) => [s.sizeClass, s.onHandQty ?? 0]))
  const usage = Object.fromEntries(
    (data.value?.demandForecast?.bySize ?? []).map((s) => [s.sizeClass, s.forecastUsageQty ?? 0]),
  )
  const rows = ['S', 'M', 'L']
    .filter((size) => size in stock || size in usage)
    .map((size) => {
      const value = months(stock[size] ?? 0, usage[size] ?? 0)
      return { id: size, label: SIZE_LABEL[size], stock: stock[size] ?? 0, usage: usage[size] ?? 0, months: value }
    })
  return rows.map((row) => ({
    ...row,
    monthsText: monthsText(row.months),
    tone: monthsTone(row.months),
    // 막대 전체 = 현재 재고, 채워진 부분 = 다음 달 예측량을 쓰고 남는 재고(왼쪽), 나머지 빈칸 = 예측량
    remaining: Math.max(0, row.stock - row.usage),
    remainingPct: row.stock > 0 ? (Math.max(0, row.stock - row.usage) / row.stock) * 100 : 0,
  }))
})

const lowSizes = computed(() => sizes.value.filter((size) => size.tone === 'warn'))
const counts = computed(() => orders.value?.counts ?? {})
// 발주 상태는 승인 완료와 입고 완료 두 가지입니다. 진행 중 발주 = 아직 입고되지 않은 승인 완료 건.
const approvedCount = computed(() => counts.value.APPROVED ?? 0)
const receivedCount = computed(() => counts.value.RECEIVED ?? 0)

const kpis = computed(() => {
  const inventory = data.value?.inventory
  const totalUsage = data.value?.demandForecast?.totalForecastUsageQty
  const overall = months(inventory?.totalOnHandQty, totalUsage)
  const shortage = inventory?.shortageSpecCount ?? 0
  const worst = lowSizes.value[0]
  return [
    {
      id: 'stock',
      label: '현재 재고',
      value: number(inventory?.totalOnHandQty),
      unit: '개',
      hint: `${number(inventory?.activeSpecCount)}개 규격`,
      tone: 'muted',
    },
    {
      id: 'forecast',
      label: '다음 달 예측 소모량',
      value: number(totalUsage),
      unit: '개',
      hint: `${data.value?.targetMonth ?? '다음 달'} 출고 예측`,
      tone: 'muted',
    },
    {
      id: 'coverage',
      label: '재고 여유',
      value: overall == null ? '—' : overall.toFixed(1),
      unit: '개월분',
      hint: worst ? `⚠ ${worst.id} ${worst.monthsText}` : '✓ 모든 규격 여유 있음',
      tone: worst ? 'warn' : 'ok',
    },
    {
      id: 'orders',
      label: '진행 중 발주',
      value: number(approvedCount.value),
      unit: '건',
      hint: ``,
      tone: 'muted',
    },
    {
      id: 'shortage',
      label: '안전재고 부족',
      value: number(shortage),
      unit: '개 규격',
      hint: shortage ? '⚠ 발주 필요' : '✓ 정상',
      tone: shortage ? 'warn' : 'ok',
    },
  ]
})

// 상태 배지 색을 상태마다 다르게 둡니다.
const ORDER_TONE = { APPROVED: 'info', RECEIVED: 'success' }
const recentOrders = computed(() =>
  (orders.value?.items ?? []).map((order) => {
    const row = orderRow(order)
    return {
      ...row,
      orderedShort: row.orderedAt.slice(5),
      amountNumber: number(order.totalAmountKrw),
      tone: ORDER_TONE[order.status] ?? 'neutral',
      statusLabel: ORDER[order.status] ?? order.status,
    }
  }),
)

// 비용 항목은 값이 없어도 항상 보여 주고, 값이 없으면 '계산 전'으로 표시합니다.
const costItems = computed(() => {
  const current = data.value?.currentMonthCost?.result?.forecast
  const target = data.value?.targetMonthCost?.result?.forecast
  const proposalQty = data.value?.demandForecast?.proposal?.result?.totalQty
  return [
    { id: 'cost', label: '이번 달 포장비', value: current?.packagingCostKrw, hint: '' },
    {
      id: 'saving',
      label: '월 포장비 절감액',
      value: current?.packagingSavingsKrw,
      hint: '',
    },
    {
      id: 'next',
      label: '다음 달 박스 발주 예정',
      value: target?.purchaseCostKrw,
      hint: proposalQty == null ? '' : `${number(proposalQty)}개`,
    },
  ]
})
</script>

<template>
  <div class="dashboard">
    <ApiState :error="error" @retry="refresh" />

    <div class="dashboard__toolbar">
      <h1 class="dashboard__heading">센터 현황</h1>
      <div class="dashboard__refresh-group">
        <span class="dashboard__loaded-at">{{ loadedAt ? `기준 ${time(loadedAt)}` : '불러오는 중' }}</span>
        <AppButton
          class="dashboard__refresh"
          :disabled="loading"
          aria-label="새로고침"
          title="새로고침"
          @click="refresh"
        >
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
    </div>

    <!-- ① KPI 띠 -->
    <section class="kpis" aria-label="핵심 지표">
      <div v-for="kpi in kpis" :key="kpi.id" class="kpi" :class="`kpi--${kpi.tone}`">
        <p class="kpi__label">{{ kpi.label }}</p>
        <p class="kpi__value">
          {{ kpi.value }}<span class="kpi__unit">{{ kpi.unit }}</span>
        </p>
        <p class="kpi__hint">{{ kpi.hint }}</p>
      </div>
    </section>

    <!-- ② 규격별 재고 vs 예측 + 비용 · 절감 -->
    <div class="dashboard__row dashboard__row--main">
      <AppCard class="dashboard__compare" title="규격별 다음달 예측 재고량">
        <ul class="compare">
          <li v-for="size in sizes" :key="size.id" class="compare__row">
            <div class="compare__head">
              <span class="compare__label">
                {{ size.label }}
                <span class="compare__months">{{ size.months == null ? '—' : `${size.monthsText} 여유` }}</span>
              </span>
              <span class="compare__value">
                <span class="compare__usage">예측 {{ number(size.usage) }}</span>
                / 현재 {{ number(size.stock) }}개
              </span>
            </div>
            <div
              class="stock-bar"
              role="img"
              :aria-label="`${size.label} 현재 ${number(size.stock)}개 중 다음 달 예측 ${number(size.usage)}개, 남는 재고 ${number(size.remaining)}개`"
            >
              <span v-if="size.remainingPct > 0" class="stock-bar__left" :style="{ width: `${size.remainingPct}%` }" />
            </div>
          </li>
        </ul>
        <p v-if="!sizes.length" class="empty">규격별 재고·예측 데이터가 아직 없어요.</p>
        <p class="compare__note">
          <span><strong class="compare__key">채워진 부분</strong> = 다음 달 예측량을 쓰고 남는 재고</span>
          <span>재고 여유 = 현재 재고 ÷ 다음 달 예측</span>
        </p>
      </AppCard>

      <AppCard class="dashboard__costs" title="비용 · 절감" meta="VAT 별도">
        <dl class="costs">
          <div v-for="item in costItems" :key="item.id" class="cost">
            <dt>
              {{ item.label }}
              <small v-if="item.hint">{{ item.hint }}</small>
            </dt>
            <dd :class="{ cost__pending: item.value == null }">
              {{ item.value == null ? '계산 전' : currency(item.value) }}
            </dd>
          </div>
        </dl>
      </AppCard>
    </div>

    <!-- ③ 실시간 센터 현황(크게) · 최근 발주 -->
    <div class="dashboard__row dashboard__row--detail">
      <AppCard class="dashboard__live">
        <LiveTwinPanel />
      </AppCard>

      <AppCard class="dashboard__orders" title="최근 발주" meta="최근 3개월">
        <table v-if="recentOrders.length" class="orders">
          <thead>
            <tr>
              <th scope="col">발주일</th>
              <th scope="col">규격</th>
              <th scope="col" class="orders__num">금액(원)</th>
              <th scope="col" class="orders__status">상태</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in recentOrders" :key="order.id" :title="`${order.number} · ${order.quantity}`">
              <td>{{ order.orderedShort }}</td>
              <td class="orders__spec">{{ order.specs }}</td>
              <td class="orders__num">{{ order.amountNumber }}</td>
              <td class="orders__status"><StatusBadge :label="order.statusLabel" :tone="order.tone" /></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="empty">최근 3개월 동안의 발주 내역이 없어요.</p>
        <RouterLink class="orders__more" to="/purchase-orders">
          발주서 이력 보기 <span aria-hidden="true">→</span>
        </RouterLink>
      </AppCard>
    </div>
  </div>
</template>

<style scoped>
/*
 * 한 화면에 모두 보이도록 대시보드를 화면 높이만큼의 세로 칸으로 잡고,
 * 위 두 줄은 내용 높이만큼, 마지막 줄(실시간 센터 현황)이 남은 높이를 채웁니다.
 * 화면이 낮아 내용이 넘치면 지금처럼 스크롤됩니다.
 */
.dashboard {
  --tone-warn: var(--color-warning-text);
  --tone-ok: var(--color-success-text);
  --tone-info: var(--color-info-text);
  --gap: 14px;

  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 48px);
  min-height: calc(100svh - 48px);
  font-variant-numeric: tabular-nums;
}

/* 대시보드에서만 본문 위아래 여백(기본 40px / 72px)을 줄입니다. 모바일은 메뉴 버튼 자리 때문에 그대로 둡니다. */
@media (min-width: 901px) {
  :global(.app-layout .app-layout__content:has(> .dashboard)) {
    padding-top: 24px;
    padding-bottom: 24px;
  }
}

/* 카드 안쪽 여백도 대시보드에서만 촘촘하게 둡니다. */
.dashboard :deep(.app-card__header) {
  padding: 16px 20px 0;
}

.dashboard :deep(.app-card__body--padded) {
  padding: 12px 20px 16px;
}

.dashboard__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.dashboard__heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.4px;
}

.dashboard__refresh-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dashboard__loaded-at {
  color: var(--color-text-secondary);
  font-size: 13px;
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

/* ① KPI 띠 */
.kpis {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: var(--gap);
}

.kpi {
  padding: 12px 16px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-lg);
  background: var(--color-white);
}

.kpi--warn {
  border-color: #f3d39a;
  background: var(--color-warning-bg);
}

.kpi__label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.kpi__value {
  margin: 4px 0 0;
  font-size: 26px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.8px;
}

.kpi__unit {
  margin-left: 3px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0;
}

.kpi__hint {
  margin: 4px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.kpi--warn .kpi__hint {
  color: var(--tone-warn);
  font-weight: 600;
}

.kpi--ok .kpi__hint {
  color: var(--tone-ok);
}

/* 행 배치 */
.dashboard__row {
  display: grid;
  gap: var(--gap);
  margin-bottom: var(--gap);
}

.dashboard__row--detail {
  flex: 1;
  min-height: 0;
  margin-bottom: 0;
}

.dashboard__row--main,
.dashboard__row--detail {
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
}

/* 최근 발주는 실시간 센터 현황과 같은 높이를 채우고, 이력 링크는 맨 아래에 둡니다. */
.dashboard__orders :deep(.app-card__body) {
  display: flex;
  flex-direction: column;
}

/* 실시간 센터 현황은 왼쪽 큰 칸을 채워 시뮬레이션을 크게 보여 줍니다. */
.dashboard__live :deep(.app-card__body) {
  display: flex;
  flex-direction: column;
}

.dashboard__live :deep(.live-preview .twin),
.dashboard__live :deep(.live__placeholder) {
  min-height: 240px;
}

.dashboard__live :deep(.live__head) {
  margin-bottom: 10px;
}

/* ② 규격별 재고 vs 예측: 옆 '비용 · 절감' 카드 높이만큼 늘어나면 남는 높이를 그래프 줄 사이에 나눠 주고, 설명은 맨 아래에 둡니다. */
.dashboard__compare :deep(.app-card__body) {
  display: flex;
  flex-direction: column;
}

.dashboard__compare .compare {
  flex: 1;
  align-content: space-evenly;
  /* 그래프 위아래에 여유를 두어 카드 높이를 10px 늘립니다. */
  padding: 4px 0 6px;
}

.dashboard__compare .compare__note {
  margin-top: auto;
}

.compare {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.compare__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 7px;
}

.compare__label {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
}

/* 규격 이름 옆에 재고 여유(몇 개월분)를 작게 붙입니다. */
.compare__months {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.compare__value {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

/* 예측은 막대의 빈 부분(크림색)과 같은 계열 색으로 씁니다. 크림색 그대로는 흰 배경에서 안 보여 읽을 수 있게 진하게 맞췄습니다. */
.compare__usage {
  color: #b8925f;
}

/* 설명의 '채워진 부분'은 막대 채움과 같은 금색으로 써서 무엇을 가리키는지 바로 보이게 합니다. */
.compare__key {
  color: var(--color-gold);
  font-weight: 700;
}

/* 막대 전체가 현재 재고, 왼쪽에 채워진 부분이 다음 달을 쓰고 남는 재고입니다. */
.stock-bar {
  overflow: hidden;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--color-cream-strong);
}

.stock-bar__left {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--color-gold);
}

/* 두 식을 세로 구분선으로 나눠 따로 읽히게 합니다. 좁으면 줄을 바꿉니다. */
.compare__note {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin: 12px 0 0;
  padding-top: 10px;
  border-top: 1px solid var(--color-divider);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.compare__note span + span {
  padding-left: 12px;
  border-left: 1px solid var(--color-card-border);
}

/* ③ 최근 발주 표 */
.orders {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.orders th {
  padding: 2px 8px 10px;
  border-bottom: 1px solid var(--color-divider);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
}

.orders td {
  padding: 11px 8px;
  border-bottom: 1px solid var(--color-divider);
}

.orders tr:last-child td {
  border-bottom: 0;
}

.orders th:first-child,
.orders td:first-child {
  padding-left: 0;
}

.orders th:last-child,
.orders td:last-child {
  padding-right: 0;
}

.orders__spec {
  overflow: hidden;
  max-width: 120px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.orders__num {
  text-align: right !important;
  font-weight: 600;
}

.orders__status {
  width: 76px;
  text-align: right !important;
}

.orders__more {
  margin-top: auto;
  padding-top: 10px;
  color: var(--color-brown);
  font-size: 13px;
  font-weight: 600;
  text-decoration: none;
}

.orders__more:hover {
  text-decoration: underline;
}

/* 비용 */
/* 카드에 남는 높이를 세 줄에 똑같이 나눠 줄마다 여유를 둡니다. */
.dashboard__costs :deep(.app-card__body) {
  display: flex;
  flex-direction: column;
}

.costs {
  display: grid;
  flex: 1;
  grid-auto-rows: 1fr;
  margin: 0;
}

.cost {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-divider);
}

.cost:last-child {
  border-bottom: 0;
}

.cost dt {
  display: grid;
  font-size: 13px;
  font-weight: 500;
}

.cost dt small {
  margin-top: 3px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 400;
}

.cost dd {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
}

.cost dd.cost__pending {
  color: var(--color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.empty {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 13px;
}

@media (max-width: 1280px) {
  .kpis {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1100px) {
  .dashboard__row--main,
  .dashboard__row--detail {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
