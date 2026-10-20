<script setup>
import { computed, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatCard from '@/components/common/StatCard.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import SafetyStockModal from './SafetyStockModal.vue'
import StockInModal from './StockInModal.vue'
import { boxInventory, inventoryStats, inventoryUpdatedAt } from '@/mocks/boxes'

const keyword = ref('')
const statusFilter = ref('all')
const specs = ref(boxInventory.map((item) => ({ ...item })))

const editingSpec = ref(null)
const stockInSpec = ref(null)
const toastMessage = ref('')

const columns = [
  { key: 'code', label: '박스 규격', width: '13%' },
  { key: 'dimensions', label: '사이즈 (내경)', width: '17%' },
  { key: 'current', label: '현재 재고', width: '11%' },
  { key: 'safety', label: '안전 재고', width: '11%' },
  { key: 'level', label: '재고 수준', width: '17%' },
  { key: 'daysLeft', label: '예상 소진일', width: '11%' },
  { key: 'status', label: '상태', width: '9%' },
  { key: 'actions', label: '관리', width: '11%' },
]

const statusOptions = computed(() => {
  const countBy = (status) => specs.value.filter((item) => item.status === status).length
  return [
    { value: 'all', label: '전체', count: specs.value.length },
    { value: '충분', label: '충분', count: countBy('충분') },
    { value: '주의', label: '주의', count: countBy('주의') },
    { value: '부족', label: '부족', count: countBy('부족') },
  ]
})

const rows = computed(() => {
  const trimmed = keyword.value.trim().toLowerCase()

  return specs.value.filter((item) => {
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
    if (!trimmed) return true
    return `${item.code} ${item.sizeName}`.toLowerCase().includes(trimmed)
  })
})

const TONE_BY_STATUS = { 충분: 'info', 주의: 'warning', 부족: 'danger' }

function toNumber(text) {
  return Number(String(text).replace(/[^\d]/g, ''))
}

// 현재 재고와 안전 재고 비율로 상태를 다시 매깁니다.
function statusOf(current, safety) {
  const ratio = safety ? current / safety : 1
  if (ratio < 1) return '부족'
  if (ratio < 1.3) return '주의'
  return '충분'
}

function handleSafetyStockSave({ safetyDays, safetyQuantity, alertEnabled }) {
  // TODO: 안전 재고 기준 저장 API 응답으로 목록을 갱신합니다.
  const target = editingSpec.value
  const current = toNumber(target.current)

  specs.value = specs.value.map((item) =>
    item.id === target.id
      ? {
          ...item,
          safety: `${safetyQuantity.toLocaleString('ko-KR')}개`,
          safetyDays,
          alertEnabled,
          level: Math.min(100, Math.round((current / safetyQuantity) * 100)),
          status: statusOf(current, safetyQuantity),
        }
      : item,
  )

  toastMessage.value = `${target.code} 안전 재고 기준이 ${safetyDays}일분으로 저장되었습니다.`
  editingSpec.value = null
}

function handleStockInSubmit({ specCode, nextStock }) {
  // TODO: 입고 등록 API 응답으로 목록을 갱신합니다.
  specs.value = specs.value.map((item) => {
    if (item.code !== specCode) return item
    const safety = toNumber(item.safety)
    return {
      ...item,
      current: `${nextStock.toLocaleString('ko-KR')}개`,
      level: Math.min(100, Math.round((nextStock / safety) * 100)),
      status: statusOf(nextStock, safety),
    }
  })

  toastMessage.value = `${specCode} 입고가 등록되어 재고가 ${nextStock.toLocaleString('ko-KR')}개가 되었습니다.`
  stockInSpec.value = null
}
</script>

<template>
  <div class="box-inventory">
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
        <div class="level">
          <ProgressBar :value="row.level" :tone="TONE_BY_STATUS[row.status]" :label="`${row.code} 재고 수준`" />
          <span class="level__value">{{ row.level }}%</span>
        </div>
      </template>

      <template #cell-daysLeft="{ row }">
        <span :class="{ 'days-left--danger': row.status === '부족' }">{{ row.daysLeft }}</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton size="sm" @click="editingSpec = row">수정</AppButton>
          <AppButton size="sm" @click="stockInSpec = row">입고</AppButton>
        </div>
      </template>
    </DataTable>

    <SafetyStockModal
      v-if="editingSpec"
      :spec="editingSpec"
      @close="editingSpec = null"
      @save="handleSafetyStockSave"
    />

    <StockInModal
      v-if="stockInSpec"
      :spec="stockInSpec"
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
