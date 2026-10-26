<script setup>
import { computed, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterBar from '@/components/common/FilterBar.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import Pagination from '@/components/common/Pagination.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SelectField from '@/components/common/SelectField.vue'
import StatGrid from '@/components/common/StatGrid.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal.vue'
import ApiState from '@/components/common/ApiState.vue'
import DateField from '@/components/common/DateField.vue'
import { warehouseApi } from '@/stores/auth'
import { ORDER, currency, localDate, number } from '@/api/format'
import { orderRow } from '@/api/rows'
import { orderDetail } from '@/api/models'
import { useListQuery } from '@/composables/useListQuery'
const keyword = ref(''),
  statusFilter = ref('all'),
  sort = ref('ordered-desc')
const today = localDate(),
  [year, month] = today.split('-').map(Number)
const from = ref(localDate(new Date(Date.UTC(year, month - 3, 1, 12)))),
  to = ref(today)
const orders = ref([]),
  counts = ref({}),
  summary = ref(null),
  openedDetail = ref(null),
  toastMessage = ref('')
const historyPeriod = computed(() => `조회 기간 ${from.value} – ${to.value}`)
const historySortOptions = [
  { value: 'ordered-desc', label: '최신순' },
  { value: 'ordered-asc', label: '오래된순' },
  { value: 'amount-desc', label: '발주 금액 높은 순' },
]
const columns = [
  // 발주번호는 'PO-20261021-c55eb91c' 처럼 길어서 한 줄이 들어갈 폭을 둡니다.
  { key: 'number', label: '발주번호', width: '18%', align: 'left' },
  { key: 'orderedAt', label: '발주일', width: '10%' },
  { key: 'supplier', label: '공급사', width: '10%' },
  { key: 'specs', label: '주문 규격', width: '12%' },
  { key: 'quantity', label: '총 수량', width: '10%' },
  { key: 'amount', label: '발주 금액', width: '12%' },
  { key: 'deliveryAt', label: '납품(예정)일', width: '11%' },
  { key: 'status', label: '상태', width: '9%' },
  { key: 'detail', label: '상세보기', width: '8%' },
]
const rows = computed(() => orders.value)
// 이력 목록과 집계는 승인 완료·입고 완료 발주서만 조회합니다.
const HISTORY_STATUSES = ['APPROVED', 'RECEIVED']
const statusOptions = computed(() => [
  { value: 'all', label: '전체', count: counts.value.ALL ?? 0 },
  ...HISTORY_STATUSES.map((value) => ({ value, label: ORDER[value], count: counts.value[value] ?? 0 })),
])
const stats = computed(() => [
  {
    id: 'count',
    label: '누적 발주 건수',
    value: `${number(summary.value?.totalOrderCount)}건`,
    hint: '선택한 조회 기간 기준',
  },
  {
    id: 'amount',
    label: '누적 발주 금액',
    value: currency(summary.value?.totalAmountKrw),
    hint: 'VAT 별도 · 반려 제외',
  },
  {
    id: 'in-progress',
    label: '진행 중 발주',
    value: `${number(summary.value?.inProgressCount)}건`,
    hint: '승인 완료',
  },
  {
    id: 'lead',
    label: '평균 납품 리드타임',
    value:
      summary.value?.averageDeliveryLeadTimeDays == null
        ? '—'
        : `${number(summary.value.averageDeliveryLeadTimeDays)}일`,
    hint: '실제 입고 완료 건 기준',
  },
])
// 조회 기간을 비우는 중에는(날짜 입력이 반쯤 지워진 상태) 조회하지 않습니다.
const { loading, error, page, totalPages, refresh } = useListQuery(
  [keyword, statusFilter, sort, from, to],
  (signal, page) =>
    from.value && to.value
      ? warehouseApi('/purchase-orders', {
          signal,
          query: {
            from: from.value,
            to: to.value,
            historyOnly: true,
            keyword: keyword.value,
            status: statusFilter.value === 'all' ? undefined : statusFilter.value,
            page,
            sort: {
              'ordered-desc': 'createdAt,desc',
              'ordered-asc': 'createdAt,asc',
              'amount-desc': 'totalAmountKrw,desc',
            }[sort.value],
          },
        })
      : null,
  ({ data }) => {
    orders.value = data.items.map(orderRow)
    counts.value = data.counts
    summary.value = data.summary
    return data.totalPages
  },
)
async function openDetail(row) {
  try {
    const { data } = await warehouseApi(`/purchase-orders/${row.id}`)
    openedDetail.value = orderDetail(data)
  } catch (cause) {
    toastMessage.value = cause.message
  }
}
</script>

<template>
  <div class="purchase-order-history">
    <ApiState :error="error" @retry="refresh" />
    <PageHeader
      title="발주서 이력 관리"
      description="승인된 발주서와 납품 진행 상태를 한눈에 확인하고 관리합니다."
      :meta="historyPeriod"
    />

    <StatGrid :stats="stats" band />

    <FilterBar>
      <div class="purchase-order-history__range">
        <DateField v-model="from" :max="to" label="시작일시" />
        <span class="purchase-order-history__range-dash" aria-hidden="true">–</span>
        <DateField v-model="to" :min="from" label="종료일시" />
      </div>
      <SearchInput v-model="keyword" width="320px" placeholder="발주번호, 공급사로 검색" aria-label="발주서 검색" />

      <template #second>
        <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="발주서 상태" />
        <SelectField
          v-model="sort"
          class="purchase-order-history__sort"
          :options="historySortOptions"
          width="160px"
          aria-label="정렬 기준"
        />
      </template>
    </FilterBar>

    <DataTable
      :columns="columns"
      :rows="rows"
      row-key="id"
      :loading="loading"
      empty-text="조건에 맞는 발주서가 없습니다."
    >
      <template #cell-number="{ row }">
        <button class="order-number" type="button" @click="openDetail(row)">{{ row.number }}</button>
      </template>

      <template #cell-deliveryAt="{ row }">
        <span :class="{ 'cell--empty': row.deliveryAt === '—' }">{{ row.deliveryAt }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.statusLabel" />
      </template>

      <template #cell-detail="{ row }">
        <AppButton size="sm" @click="openDetail(row)">상세</AppButton>
      </template>
    </DataTable>

    <Pagination v-model="page" class="purchase-order-history__pagination" :total-pages="totalPages" />

    <PurchaseOrderDetailModal v-if="openedDetail" :detail="openedDetail" @close="openedDetail = null" />

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.purchase-order-history__sort {
  margin-left: auto;
}

/* 조회 기간: 시작·종료 입력을 줄표로 묶어 한 덩어리로 보여 줍니다. */
.purchase-order-history__range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.purchase-order-history__range-dash {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* 발주번호는 줄바꿈되면 행 높이가 늘고 왼쪽 끝이 어긋나 보여서 한 줄로 고정합니다. */
.order-number {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}

.order-number:hover {
  color: var(--color-brown);
  text-decoration: underline;
}

.purchase-order-history__pagination {
  margin-top: 24px;
}

.purchase-order-history__note {
  margin: 28px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.6;
  word-break: keep-all;
}
</style>
