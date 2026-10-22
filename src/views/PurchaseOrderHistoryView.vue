<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import Pagination from '@/components/common/Pagination.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SelectField from '@/components/common/SelectField.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal.vue'
import ApiState from '@/components/common/ApiState.vue'
import DateField from '@/components/common/DateField.vue'
import { warehouseApi } from '@/stores/auth'
import { ORDER, orderRow, orderDetail, localDate, currency, number } from '@/api/adapters'
import { useRemote } from '@/composables/useRemote'
const keyword = ref(''), statusFilter = ref('all'), sort = ref('ordered-desc'), page = ref(1), totalPages = ref(0)
const today = localDate(), [year, month] = today.split('-').map(Number)
const from = ref(localDate(new Date(Date.UTC(year, month - 3, 1, 12)))), to = ref(today)
const orders = ref([]), counts = ref({}), summary = ref(null), openedDetail = ref(null), toastMessage = ref('')
const { loading, error, load } = useRemote()
const historyPeriod = computed(() => `조회 기간 ${from.value} – ${to.value}`)
const historySortOptions = [{ value: 'ordered-desc', label: '최신 발주일 순' }, { value: 'ordered-asc', label: '오래된 발주일 순' }, { value: 'amount-desc', label: '발주 금액 높은 순' }]
const columns = [
  { key: 'number', label: '발주번호', width: '13%' }, { key: 'orderedAt', label: '발주일', width: '10%' },
  { key: 'supplier', label: '공급사', width: '12%' }, { key: 'specs', label: '주문 규격', width: '15%' },
  { key: 'quantity', label: '총 수량', width: '10%' }, { key: 'amount', label: '발주 금액', width: '12%' },
  { key: 'deliveryAt', label: '납품(예정)일', width: '11%' }, { key: 'status', label: '상태', width: '9%' }, { key: 'detail', label: '상세보기', width: '8%' },
]
const rows = computed(() => orders.value)
const statusOptions = computed(() => [{ value: 'all', label: '전체', count: counts.value.ALL ?? 0 }, ...Object.entries(ORDER).map(([value, label]) => ({ value, label, count: counts.value[value] ?? 0 }))])
const stats = computed(() => [
  { id: 'count', label: '누적 발주 건수', value: `${number(summary.value?.totalOrderCount)}건`, hint: '선택한 조회 기간 기준' },
  { id: 'amount', label: '누적 발주 금액', value: currency(summary.value?.totalAmountKrw), hint: 'VAT 별도 · 반려 제외' },
  { id: 'in-progress', label: '진행 중 발주', value: `${number(summary.value?.inProgressCount)}건`, hint: '승인 완료 · 배송 중' },
  { id: 'lead', label: '평균 납품 리드타임', value: summary.value?.averageDeliveryLeadTimeDays == null ? '—' : `${number(summary.value.averageDeliveryLeadTimeDays)}일`, hint: '실제 입고 완료 건 기준' },
])
function refresh() {
  if (!from.value || !to.value) return
  return load(signal => warehouseApi('/purchase-orders', { signal, query: { from: from.value, to: to.value, keyword: keyword.value,
    status: statusFilter.value === 'all' ? undefined : statusFilter.value, page: page.value - 1,
    sort: ({ 'ordered-desc': 'createdAt,desc', 'ordered-asc': 'createdAt,asc', 'amount-desc': 'totalAmountKrw,desc' })[sort.value] } }),
  ({ data }) => { orders.value = data.items.map(orderRow); counts.value = data.counts; summary.value = data.summary; totalPages.value = data.totalPages })
}
watch([keyword, statusFilter, sort, from, to], () => { if (page.value !== 1) page.value = 1; else refresh() }); watch(page, refresh); onMounted(refresh)
async function openDetail(row) {
  try { const { data } = await warehouseApi(`/purchase-orders/${row.id}`); openedDetail.value = orderDetail(data) }
  catch (cause) { toastMessage.value = cause.message }
}
</script>

<template>
  <div class="purchase-order-history">
    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <PageHeader
      title="발주서 이력 관리"
      description="승인된 발주서와 납품 진행 상태를 한눈에 확인하고 관리합니다."
      :meta="historyPeriod"
    />

    <div class="purchase-order-history__stats">
      <StatCard
        v-for="stat in stats"
        :key="stat.id"
        :label="stat.label"
        :value="stat.value"
        :hint="stat.hint"
      />
    </div>

    <div class="purchase-order-history__filters">
      <DateField v-model="from" :max="to" aria-label="조회 시작일" />
      <DateField v-model="to" :min="from" aria-label="조회 종료일" />
      <SearchInput
        v-model="keyword"
        width="320px"
        placeholder="발주번호, 공급사로 검색"
        aria-label="발주서 검색"
      />
      <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="발주서 상태" />
      <SelectField
        v-model="sort"
        class="purchase-order-history__sort"
        :options="historySortOptions"
        width="160px"
        aria-label="정렬 기준"
      />
    </div>

    <DataTable :columns="columns" :rows="rows" row-key="id" empty-text="조건에 맞는 발주서가 없습니다.">
      <template #cell-number="{ row }">
        <button class="order-number" type="button" @click="openDetail(row)">{{ row.number }}</button>
      </template>

      <template #cell-deliveryAt="{ row }">
        <span :class="{ 'cell--empty': row.deliveryAt === '—' }">{{ row.deliveryAt }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.status" />
      </template>

      <template #cell-detail="{ row }">
        <AppButton size="sm" @click="openDetail(row)">상세</AppButton>
      </template>
    </DataTable>

    <Pagination v-model="page" class="purchase-order-history__pagination" :total-pages="totalPages" />

    <p class="purchase-order-history__note">
      발주번호를 누르거나 [상세]를 선택하면 규격별 수량·단가와 승인 이력을 확인할 수 있습니다.
      서버에 저장된 승인 및 입고 정보를 표시합니다.
    </p>

    <PurchaseOrderDetailModal v-if="openedDetail" :detail="openedDetail" @close="openedDetail = null" />

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.purchase-order-history__stats {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 20px;
}

.purchase-order-history__filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.purchase-order-history__sort {
  margin-left: auto;
}

.order-number {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.order-number:hover {
  color: var(--color-brown);
  text-decoration: underline;
}

.cell--empty {
  color: var(--color-text-muted);
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

@media (max-width: 1180px) {
  .purchase-order-history__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
