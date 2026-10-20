<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
import {
  historyPeriod,
  historySortOptions,
  historyStats,
  historyStatusCounts,
  historyTotalPages,
  purchaseOrderDetails,
  purchaseOrders,
} from '@/mocks/orders'

const route = useRoute()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref('all')
const sort = ref('ordered-desc')
const page = ref(1)
const orders = ref(purchaseOrders.map((item) => ({ ...item })))
const openedDetail = ref(null)
const toastMessage = ref('')

const columns = [
  { key: 'number', label: '발주번호', width: '13%' },
  { key: 'orderedAt', label: '발주일', width: '10%' },
  { key: 'supplier', label: '공급사', width: '12%' },
  { key: 'specs', label: '주문 규격', width: '15%' },
  { key: 'quantity', label: '총 수량', width: '10%' },
  { key: 'amount', label: '발주 금액', width: '12%' },
  { key: 'deliveryAt', label: '납품(예정)일', width: '11%' },
  { key: 'status', label: '상태', width: '9%' },
  { key: 'detail', label: '상세보기', width: '8%' },
]

// 승인은 박스 주문 화면에서 끝나므로, 이력에는 승인 이후 상태만 나옵니다.
const STATUSES = ['승인 완료', '배송 중', '입고 완료', '반려']

// 아직 입고되지 않은 건 (승인 완료 + 배송 중)
const inProgressCount = computed(
  () => orders.value.filter((item) => item.status === '승인 완료' || item.status === '배송 중').length,
)

// 칩 건수는 전체 24건 기준이라 목록에 보이는 행 수와 다릅니다.
const statusOptions = computed(() => {
  const chips = [{ value: 'all', label: '전체', count: historyStatusCounts.total }]

  STATUSES.forEach((status) => {
    const count = historyStatusCounts[status]
    if (count > 0) chips.push({ value: status, label: status, count })
  })

  return chips
})

const stats = computed(() =>
  historyStats.map((stat) =>
    stat.id === 'in-progress' ? { ...stat, value: `${inProgressCount.value}건` } : stat,
  ),
)

const rows = computed(() => {
  const trimmed = keyword.value.trim().toLowerCase()

  return orders.value.filter((item) => {
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
    if (!trimmed) return true
    return `${item.number} ${item.supplier}`.toLowerCase().includes(trimmed)
  })
})

function openDetail(row) {
  const detail = purchaseOrderDetails[row.id]
  if (!detail) {
    // TODO: 상세 조회 API로 발주서별 상세를 가져옵니다.
    toastMessage.value = `${row.number} 상세 정보를 준비 중입니다.`
    return
  }
  openedDetail.value = { ...detail, status: row.status }
}

// 박스 주문 화면에서 승인하고 넘어오면 해당 건을 승인 완료로 반영합니다.
// 납품 희망일을 바꿨다면 목록의 납품(예정)일도 함께 바뀝니다.
function applyApproval(number, deliveryAt = '') {
  const formatted = deliveryAt ? deliveryAt.replaceAll('-', '.') : ''

  orders.value = orders.value.map((item) =>
    item.number === number
      ? { ...item, status: '승인 완료', deliveryAt: formatted || item.deliveryAt }
      : item,
  )
  toastMessage.value = `${number} 발주서가 승인되어 공급사(OO 포장산업)에 전송되었습니다.`
}

// 박스 주문 화면에서 승인하고 넘어오면 쿼리로 발주번호가 전달됩니다.
onMounted(() => {
  const approved = route.query.approved
  if (!approved) return
  applyApproval(String(approved), route.query.deliveryAt ? String(route.query.deliveryAt) : '')
  router.replace({ path: '/purchase-orders' })
})
</script>

<template>
  <div class="purchase-order-history">
    <PageHeader
      title="발주서 이력"
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

    <Pagination v-model="page" class="purchase-order-history__pagination" :total-pages="historyTotalPages" />

    <p class="purchase-order-history__note">
      발주번호를 누르거나 [상세]를 선택하면 규격별 수량·단가와 승인 이력을 확인할 수 있습니다.
      AI 제안서로 생성된 발주서는 담당자 승인 후 공급사에 전송됩니다.
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
