<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import SafetyStockModal from './SafetyStockModal.vue'
import StockInModal from './StockInModal.vue'
import ApiState from '@/components/common/ApiState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { STOCK, inventoryRow, quantity, number, time } from '@/api/adapters'
import { useRemote } from '@/composables/useRemote'
const keyword = ref(''), statusFilter = ref('all'), page = ref(1), totalPages = ref(0)
const specs = ref([]), summary = ref(null), counts = ref({})
const editingSpec = ref(null), stockInSpec = ref(null), toastMessage = ref(''), saving = ref(false)
const { loading, error, load } = useRemote()
const columns = [
  { key: 'code', label: '박스 규격', width: '13%' }, { key: 'dimensions', label: '사이즈 (내경)', width: '17%' },
  { key: 'current', label: '현재 재고', width: '11%' }, { key: 'safety', label: '안전 재고', width: '11%' },
  { key: 'level', label: '재고 수준', width: '17%' }, { key: 'daysLeft', label: '예상 소진일', width: '11%' },
  { key: 'status', label: '상태', width: '9%' }, { key: 'actions', label: '관리', width: '11%' },
]
const rows = computed(() => specs.value)
const TONE_BY_STATUS = { 충분: 'info', 주의: 'warning', 부족: 'danger', 미확인: 'neutral' }
const statusOptions = computed(() => [{ value: 'all', label: '전체', count: counts.value.ALL ?? 0 }, ...Object.entries(STOCK).map(([value, label]) => ({ value, label, count: counts.value[value] ?? 0 }))])
const inventoryUpdatedAt = computed(() => time(summary.value?.lastUpdatedAt))
const inventoryStats = computed(() => [
  { id: 'total', label: '총 보유 박스', value: quantity(summary.value?.totalOnHandQty), hint: `${number(summary.value?.activeSpecCount)}개 규격 운영 중` },
  { id: 'shortage', label: '재고 부족 규격', value: `${number(summary.value?.shortageSpecCount)}개`, hint: '안전 재고 미만', tone: 'danger' },
  { id: 'weekly', label: '이번 주 참고 수량', value: quantity(summary.value?.weeklyForecastUsageQty), hint: '저장된 참고 계산 기준' },
  { id: 'lead', label: '평균 재고 소진일', value: summary.value?.avgDaysToStockout == null ? '—' : `${number(summary.value.avgDaysToStockout)}일`, hint: '등록된 소진일 기준' },
])
function refresh() {
  return load(signal => warehouseApi('/box-inventories', { signal, query: { keyword: keyword.value, status: statusFilter.value === 'all' ? undefined : statusFilter.value, page: page.value - 1, size: 100 } }),
    ({ data }) => { specs.value = data.items.map(inventoryRow); summary.value = data.summary; counts.value = data.counts; totalPages.value = data.totalPages })
}
watch([keyword, statusFilter], () => { if (page.value !== 1) page.value = 1; else refresh() }); watch(page, refresh); onMounted(refresh)
async function handleSafetyStockSave(form) {
  if (saving.value) return
  saving.value = true
  try {
    await warehouseApi(`/box-inventories/${editingSpec.value.id}/policy`, { method: 'PATCH', body: { expectedVersion: editingSpec.value.version,
      safetyDays: form.useDays ? Number(form.safetyDays) : undefined, safetyQty: form.useDays ? undefined : Number(form.safetyQuantity), alertEnabled: form.alertEnabled } })
    editingSpec.value = null; toastMessage.value = '안전 재고 기준이 저장되었습니다.'; await refresh()
  } catch (cause) { toastMessage.value = cause.message }
  finally { saving.value = false }
}
async function handleStockInSubmit(form) {
  if (saving.value) return
  saving.value = true
  try {
    const qty = Number(form.quantity)
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('입고 수량은 양수 정수로 입력해 주세요.')
    const target = specs.value.find(item => item.id === form.specId)
    await warehouseApi('/inventory-receipts', { method: 'POST', body: { requestId: form.requestId, boxSpecId: form.specId,
      expectedVersion: target.version, purchaseOrderId: form.orderNumber || undefined, qty, receivedDate: form.receivedAt, memo: form.memo || undefined } })
    stockInSpec.value = null; toastMessage.value = '입고가 등록되었습니다.'; await refresh()
  } catch (cause) { toastMessage.value = cause.message }
  finally { saving.value = false }
}
</script>

<template>
  <div class="box-inventory">
    <PageHeader
      title="박스 재고 관리"
      description="보유 중인 택배 상자 재고를 규격별로 확인하고 관리합니다."
    />

    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <div class="box-inventory__stats">
      <StatCard
        v-for="stat in inventoryStats"
        :key="stat.id"
        :label="stat.label"
        :value="stat.value"
        :hint="stat.hint"
        :tone="stat.tone ?? 'default'"
      />
    </div>

    <div class="box-inventory__filters">
      <SearchInput v-model="keyword" width="320px" placeholder="박스 규격 검색" aria-label="박스 규격 검색" />
      <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="재고 상태" />
      <span class="box-inventory__updated">{{ inventoryUpdatedAt }}</span>
    </div>

    <DataTable :columns="columns" :rows="rows" row-key="id" empty-text="조건에 맞는 규격이 없습니다.">
      <template #cell-code="{ row }">
        <span class="spec-name">
          <strong>{{ row.code }}</strong>
          <span class="spec-name__size">{{ row.sizeName }}</span>
        </span>
      </template>

      <template #cell-current="{ row }">
        <strong>{{ row.current }}</strong>
      </template>

      <template #cell-level="{ row }">
        <div v-if="row.level != null" class="level">
          <ProgressBar :value="row.level" :tone="TONE_BY_STATUS[row.status]" :label="`${row.code} 재고 수준`" />
          <span class="level__value">{{ row.level }}%</span>
        </div>
        <span v-else>—</span>
      </template>

      <template #cell-daysLeft="{ row }">
        <span :class="{ 'days-left--danger': row.status === '부족' }">{{ row.daysLeft }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton size="sm" :disabled="!auth.canEdit.value" @click="editingSpec = row">수정</AppButton>
          <AppButton size="sm" :disabled="!auth.canEdit.value || row.onHandQty == null" @click="stockInSpec = row">입고</AppButton>
        </div>
      </template>
    </DataTable>

    <Pagination v-if="totalPages > 1" v-model="page" :total-pages="totalPages" />

    <SafetyStockModal
      v-if="editingSpec"
      :spec="editingSpec" :busy="saving"
      @close="editingSpec = null"
      @save="handleSafetyStockSave"
    />

    <StockInModal
      v-if="stockInSpec"
      :spec="stockInSpec" :specs="specs" :busy="saving"
      @close="stockInSpec = null"
      @submit="handleStockInSubmit"
    />

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.box-inventory__stats {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 20px;
}

.box-inventory__filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.box-inventory__updated {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.spec-name {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
}

.spec-name__size {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.level {
  display: flex;
  align-items: center;
  gap: 10px;
}

.level :deep(.progress-bar) {
  width: 110px;
  flex: none;
}

.level__value {
  font-size: 13px;
  font-weight: 600;
}

.days-left--danger {
  color: var(--color-danger);
  font-weight: 600;
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

@media (max-width: 1180px) {
  .box-inventory__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
