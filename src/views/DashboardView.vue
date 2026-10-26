<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppCard from '@/components/common/AppCard.vue'
import AppButton from '@/components/common/AppButton.vue'
import AnimatedNumber from '@/components/common/AnimatedNumber.vue'
import ApiState from '@/components/common/ApiState.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import LiveTwinPanel from '@/components/dashboard/LiveTwinPanel.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { apiUrl } from '@/api/client.js'
import { createInventorySubscription, mergeInventory } from '@/live/stream.js'
import { ORDER, currency, localDate, number, time } from '@/api/format'
import { orderRow } from '@/api/rows'
import { useRemote } from '@/composables/useRemote'

// 대시보드: ① 한눈에 보는 KPI → ② 규격별 재고 vs 예측과 비용·절감 → ③ 실시간 센터 현황과 최근 발주 순으로 배치합니다.
// 데이터는 /dashboard와 /purchase-orders(최근 3개월, 6건)를 함께 불러옵니다.
const { loading, error, load } = useRemote()
const data = ref(null)
const orders = ref(null)
const loadedAt = ref(null)
const stockLoadedAt = ref(null)
const stockError = ref('')
let stockStream

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
          query: { from: orderFrom, to: today, historyOnly: true, page: 0, size: 6, sort: 'createdAt,desc' },
        }),
      ]),
    ([dashboard, page]) => {
      // 발주·예측 새로고침은 라이브 재고의 값과 기준 시각을 바꾸지 않는다.
      const previous = data.value
      data.value = previous
        ? { ...dashboard.data, inventory: previous.inventory, stockBySize: previous.stockBySize }
        : dashboard.data
      if (!previous) stockLoadedAt.value = new Date()
      orders.value = page.data
      loadedAt.value = new Date()
    },
  )
}
onMounted(() => {
  refresh()
  stockStream = createInventorySubscription(
    apiUrl(`/warehouses/${auth.warehouseId.value}/live-stream`),
    (signal) => warehouseApi('/dashboard', { signal }),
    ({ data: next }) => {
      data.value = mergeInventory(data.value, next)
      stockLoadedAt.value = new Date()
      stockError.value = ''
    },
    (cause) => {
      stockError.value = cause.message
    },
  )
})
onBeforeUnmount(() => {
  stockStream?.stop()
})

// 재고 여유(몇 개월분) = 현재 재고 ÷ 다음 달 예측 사용량. 1.5개월 미만은 부족 주의, 12개월 이상은 과잉으로 봅니다.
const LOW_MONTHS = 1.5
const HIGH_MONTHS = 12
const SIZE_LABEL = { S: 'S (소형)', M: 'M (중형)', L: 'L (대형)' }
const SIZE_NAME = { S: '소형', M: '중형', L: '대형' }

const months = (stock, usage) => (usage > 0 && stock != null ? stock / usage : null)
const monthsText = (value) => (value == null ? '—' : `${value.toFixed(1)}개월분`)
const monthsTone = (value) =>
  value == null ? 'muted' : value < LOW_MONTHS ? 'warn' : value >= HIGH_MONTHS ? 'info' : 'ok'

// 큰 수는 만 단위로 줄여 읽습니다. 100만 이상은 정수(761만), 그 아래는 소수 첫째 자리(31.7만)로 보여 줍니다.
const manText = (value) => {
  if (value == null) return '—'
  if (value < 10000) return `${number(value)}개`
  const man = value / 10000
  return `${man >= 100 ? Math.round(man) : Number(man.toFixed(1))}만 개`
}

/**
 * 막대 전체 = 다음 달 필요량(예측 소모량, 100%), 채워진 부분 = 현재 재고, 나머지 = 부족분.
 * 확보율(현재 재고 ÷ 필요량)이 낮은 규격이 급하므로 위험 순으로 정렬합니다.
 * 예측 소모가 없는 규격은 비교 기준이 없어 막대 없이 재고만 보여 주고 맨 뒤로 보냅니다.
 */
const sizes = computed(() => {
  const stock = Object.fromEntries((data.value?.stockBySize ?? []).map((s) => [s.sizeClass, s.onHandQty ?? 0]))
  const usage = Object.fromEntries(
    (data.value?.demandForecast?.bySize ?? []).map((s) => [s.sizeClass, s.forecastUsageQty ?? 0]),
  )
  return ['S', 'M', 'L']
    .filter((size) => size in stock || size in usage)
    .map((size) => {
      const onHand = stock[size] ?? 0
      const need = usage[size] ?? 0
      const short = Math.max(0, need - onHand)
      const coverage = need > 0 ? Math.round((onHand / need) * 100) : null
      return {
        id: size,
        label: SIZE_LABEL[size],
        stock: onHand,
        usage: need,
        months: months(onHand, need),
        coverage,
        short,
        spare: Math.max(0, onHand - need),
        enough: need > 0 && onHand >= need,
        // 재고가 필요량을 넘어도 막대는 100%에서 멈춥니다. 남는 양은 오른쪽에 '여유'로 적습니다.
        fillPct: need > 0 ? Math.min(100, (onHand / need) * 100) : 0,
      }
    })
    .map((row) => ({ ...row, monthsText: monthsText(row.months), tone: monthsTone(row.months) }))
    .sort((a, b) => (a.coverage ?? Infinity) - (b.coverage ?? Infinity))
})

// 마우스를 올리면 막대·오른쪽 숫자와 같은 단어로 원래 수량을 보여 줍니다.
// 막대에는 같은 내용을 aria-label로 이미 달아 두어 이 상자는 화면 표시 전용입니다.
function tooltipRows(size) {
  if (size.coverage == null) return [['현재 재고', `${number(size.stock)}개`]]
  return [
    ['다음 달 필요량', `${number(size.usage)}개`],
    ['현재 재고', `${number(size.stock)}개`],
    size.enough ? ['여유', `${number(size.spare)}개`] : ['부족분', `${number(size.short)}개`],
    ['확보율', `${size.coverage}%`],
  ]
}

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
          aria-label="발주와 예측 새로고침"
          title="발주 현황·박스 예측량 새로고침"
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
          <AnimatedNumber :value="kpi.value" /><span class="kpi__unit">{{ kpi.unit }}</span>
        </p>
        <p class="kpi__hint">{{ kpi.hint }}</p>
        <p v-if="kpi.id === 'stock'" class="kpi__hint">
          {{ stockLoadedAt ? `${time(stockLoadedAt)} 기준` : '불러오는 중' }}
        </p>
      </div>
    </section>
    <p v-if="stockError" role="alert">재고 갱신 실패: {{ stockError }} 기존 값과 기준 시각을 유지합니다.</p>

    <!-- ② 규격별 재고 vs 예측 + 비용 · 절감 -->
    <div class="dashboard__row dashboard__row--main">
      <AppCard
        class="dashboard__compare"
        title="다음 달 필요량 대비 재고"
        :meta="`${data?.targetMonth ?? '다음 달'} 예측 기준 · 위험 순`"
      >
        <ul class="compare">
          <li v-for="size in sizes" :key="size.id" class="compare__row" tabindex="0">
            <div class="compare__tip" aria-hidden="true">
              <p class="compare__tip-title">{{ size.label }}</p>
              <dl class="compare__tip-list">
                <template v-for="[label, value] in tooltipRows(size)" :key="label">
                  <dt>{{ label }}</dt>
                  <dd>{{ value }}</dd>
                </template>
              </dl>
            </div>
            <span class="compare__label">
              <strong>{{ size.id }}</strong>
              <span class="compare__size">{{ SIZE_NAME[size.id] }}</span>
            </span>

            <!-- 예측 소모가 없으면 비교할 기준이 없어 막대 대신 안내 문구를 둡니다. -->
            <span v-if="size.coverage == null" class="compare__none">다음 달 예측 소모 없음</span>
            <div
              v-else
              class="need-bar"
              role="img"
              :aria-label="`${size.label} 다음 달 필요량 ${number(size.usage)}개 중 현재 재고 ${number(size.stock)}개, 확보율 ${size.coverage}%`"
            >
              <span
                class="need-bar__fill"
                :class="{ 'need-bar__fill--enough': size.enough }"
                :style="{ width: `${size.fillPct}%` }"
              />
            </div>

            <span v-if="size.coverage == null" class="compare__value compare__value--muted">
              재고 {{ manText(size.stock) }}
            </span>
            <span v-else class="compare__value" :class="{ 'compare__value--enough': size.enough }">
              <strong class="compare__rate"><AnimatedNumber :value="size.coverage" />%</strong>
              <span class="compare__gap">
                {{ size.enough ? `${manText(size.spare)} 여유` : `${manText(size.short)} 부족` }}
              </span>
            </span>
          </li>
        </ul>
        <p v-if="!sizes.length" class="empty">규격별 재고·예측 데이터가 아직 없어요.</p>
        <p class="compare__note">
          <span class="compare__legend"><i class="compare__swatch" />현재 재고</span>
          <span class="compare__legend"><i class="compare__swatch compare__swatch--short" />부족분</span>
          <span>막대 끝 = 다음 달 필요량</span>
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
        <div v-if="recentOrders.length" class="orders__scroll">
          <table class="orders">
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
        </div>
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

/* ② 규격별 재고 vs 예측: 옆 '비용 · 절감' 카드 높이만큼 늘어나도 그래프는 위에서 시작하고, 설명은 맨 아래에 둡니다. */
.dashboard__compare :deep(.app-card__body) {
  display: flex;
  flex-direction: column;
}

.dashboard__compare .compare {
  flex: 1;
  /* 제목 바로 아래에서 그래프를 시작하고, 카드가 옆 카드 높이만큼 늘어나 남는 높이는 아래 설명 위로 보냅니다. */
  align-content: start;
  gap: 16px;
  padding-top: 4px;
}

.dashboard__compare .compare__note {
  margin-top: auto;
}

/* 규격 라벨 · 막대 · 오른쪽 숫자를 한 줄에 놓습니다. 막대만 남는 폭을 모두 씁니다. */
.compare {
  display: grid;
  gap: 18px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.compare__row {
  position: relative;
  display: grid;
  align-items: center;
  gap: 14px;
  grid-template-columns: 72px minmax(0, 1fr) auto;
}

.compare__row:focus-visible {
  outline: 2px solid var(--color-brown);
  outline-offset: 4px;
  border-radius: var(--radius-sm);
}

/* 행에 마우스를 올리거나 키보드로 옮기면 원래 수량을 상자로 보여 줍니다. */
.compare__tip {
  position: absolute;
  z-index: 10;
  bottom: calc(100% + 8px);
  left: 72px;
  min-width: 240px;
  padding: 12px 14px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  box-shadow: 0 8px 20px rgb(0 0 0 / 12%);
  opacity: 0;
  visibility: hidden;
  transition:
    opacity 120ms ease,
    visibility 120ms ease;
}

.compare__row:hover .compare__tip,
.compare__row:focus-visible .compare__tip {
  opacity: 1;
  visibility: visible;
}

/* 첫 줄은 위가 막히므로 상자를 아래로 내립니다. */
.compare__row:first-child .compare__tip {
  top: calc(100% + 8px);
  bottom: auto;
}

.compare__tip-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
}

/* 항목은 왼쪽, 수량은 오른쪽에 붙여 자릿수를 비교하기 쉽게 둡니다. */
.compare__tip-list {
  display: grid;
  gap: 4px 16px;
  grid-template-columns: auto 1fr;
  margin: 0;
  font-size: 12px;
}

.compare__tip-list dt {
  color: var(--color-text-secondary);
}

.compare__tip-list dd {
  margin: 0;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .compare__tip {
    transition: none;
  }
}

.compare__label {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
}

.compare__size {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
}

.compare__value {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  color: var(--color-danger-text);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.compare__value--enough {
  color: var(--color-info-text);
}

.compare__value--muted {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.compare__rate {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.compare__gap {
  color: var(--color-text-secondary);
  font-weight: 500;
}

/* 예측 소모가 없는 규격. 막대 자리에 안내 문구만 둡니다. */
.compare__none {
  color: var(--color-text-secondary);
  font-size: 13px;
}

/* 막대 전체가 다음 달 필요량(100%), 채워진 부분이 현재 재고, 남은 부분이 부족분입니다. */
.need-bar {
  overflow: hidden;
  height: 14px;
  border-radius: var(--radius-pill);
  background: var(--color-danger-bg);
}

.need-bar__fill {
  display: block;
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
  transform-origin: left;
  animation: stock-bar-reveal 400ms cubic-bezier(0.22, 1, 0.36, 1);
  transition: width 400ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* 재고가 필요량을 채우면 경고색을 쓸 이유가 없습니다. */
.need-bar__fill--enough {
  background: var(--color-info);
}

@keyframes stock-bar-reveal {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .need-bar__fill {
    animation: none;
    transition: none;
  }
}

/* 범례의 색 네모는 막대의 두 영역과 같은 색을 씁니다. */
.compare__legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.compare__swatch {
  width: 18px;
  height: 10px;
  border-radius: var(--radius-pill);
  background: var(--color-danger);
}

.compare__swatch--short {
  background: var(--color-danger-bg);
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
/* 카드가 좁아지면 열을 찌그러뜨리지 않고 이 칸만 가로로 스크롤합니다. */
/* 스크롤바는 DataTable(공통 표)과 같은 베이지 계열로 맞춥니다. */
.orders__scroll {
  overflow-x: auto;
  min-width: 0;
  scrollbar-color: var(--color-border) var(--color-cream);
  scrollbar-width: thin;
}

.orders__scroll::-webkit-scrollbar {
  height: 10px;
}

.orders__scroll::-webkit-scrollbar-track {
  border-top: 1px solid var(--color-divider);
  background: var(--color-cream);
}

.orders__scroll::-webkit-scrollbar-thumb {
  border: 2px solid var(--color-cream);
  border-radius: var(--radius-pill);
  background: var(--color-border);
}

.orders__scroll::-webkit-scrollbar-thumb:hover {
  background: var(--color-gold);
}

.orders {
  width: 100%;
  min-width: 360px;
  border-collapse: collapse;
  font-size: 14px;
}

.orders th {
  padding: 2px 8px 10px;
  border-bottom: 1px solid var(--color-divider);
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.orders td {
  padding: 11px 8px;
  border-bottom: 1px solid var(--color-divider);
  text-align: center;
  white-space: nowrap;
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
  font-weight: 600;
}

.orders__status {
  width: 76px;
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
  /* 옆 '다음 달 필요량 대비 재고' 카드와 높이를 맞추는 기준이라 위아래 여백을 작게 둡니다. */
  padding: 6px 0;
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
