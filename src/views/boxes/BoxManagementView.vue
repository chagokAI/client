<script setup>
import { computed, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterBar from '@/components/common/FilterBar.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatGrid from '@/components/common/StatGrid.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import BoxSpecDeleteModal from './BoxSpecDeleteModal.vue'
import BoxSpecFormModal from './BoxSpecFormModal.vue'
import StockInModal from './StockInModal.vue'
import ApiState from '@/components/common/ApiState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { api } from '@/api/client'
import { auth, warehouseApi } from '@/stores/auth'
import { quantity, number } from '@/api/format'
import { boxStockRow } from '@/api/rows'
import { isNonNegativeInt, isPositiveInt, toDimensions } from '@/api/validate'
import { useListQuery } from '@/composables/useListQuery'
import { useSaveAction } from '@/composables/useSaveAction'
const keyword = ref(''),
  statusFilter = ref('all')
const specs = ref([]),
  counts = ref({}),
  summary = ref(null)
const formModal = ref(null),
  deletingSpec = ref(null),
  stockInSpec = ref(null)
const { saving, toastMessage, run, report } = useSaveAction()
const columns = [
  { key: 'actions', label: '관리', width: '180px' },
  { key: 'code', label: '박스 규격명', width: '190px', align: 'left' },
  { key: 'current', label: '현재 재고', width: '100px' },
  { key: 'safety', label: '안전 재고', width: '100px' },
  { key: 'level', label: '재고 수준', width: '170px' },
  { key: 'dimensions', label: '내경 사이즈 (가로 × 세로 × 높이)', width: '220px' },
  { key: 'linkedProducts', label: '연결 상품 수', width: '110px' },
  { key: 'status', label: '사용 여부', width: '100px' },
  { key: 'supplier', label: '공급사', width: '130px' },
  { key: 'description', label: '간단 설명', width: '240px', align: 'left' },
]
const TONE_BY_STOCK = { SUFFICIENT: 'info', CAUTION: 'warning', SHORTAGE: 'danger', UNKNOWN: 'neutral' }
// 재고 요약은 검색어·탭과 관계없이 센터의 활성 규격 전체 기준입니다(summary.stock).
const stockSummary = computed(() => summary.value?.stock)
const inventoryStats = computed(() => [
  {
    id: 'total',
    label: '총 보유 박스',
    value: quantity(stockSummary.value?.totalOnHandQty),
    hint: `${number(stockSummary.value?.activeSpecCount)}개 규격 운영 중`,
  },
  {
    id: 'shortage',
    label: '재고 부족 규격',
    value: `${number(stockSummary.value?.shortageSpecCount)}개`,
    hint: '안전 재고 미만',
    tone: 'danger',
  },
  {
    id: 'weekly',
    label: '이번 주 참고 수량',
    value: quantity(stockSummary.value?.weeklyForecastUsageQty),
    hint: '저장된 참고 계산 기준',
  },
  {
    id: 'lead',
    label: '평균 재고 소진일',
    value: stockSummary.value?.avgDaysToStockout == null ? '—' : `${number(stockSummary.value.avgDaysToStockout)}일`,
    hint: '등록된 소진일 기준',
  },
])
const SPEC_STATUS = { ACTIVE: '사용 중', INACTIVE: '미사용', CUSTOM: '★' }
const statusOptions = computed(() => [
  { value: 'all', label: '전체', count: counts.value.ALL ?? 0 },
  ...Object.entries(SPEC_STATUS).map(([value, label]) => ({ value, label, count: counts.value[value] ?? 0 })),
])
const specSummary = computed(() => `총 ${number(summary.value?.totalSpecCount)}개`)
const supplierOptions = ref([{ value: '', label: '미지정' }])
const materialOptions = ref([])
// 규격과 규격별 재고는 /box-stocks 한 번으로 받습니다. 재고는 각 행의 stock 에 들어 있습니다.
const { loading, error, page, totalPages, refresh } = useListQuery(
  [keyword, statusFilter],
  (signal, page) =>
    warehouseApi('/box-stocks', {
      signal,
      query: {
        keyword: keyword.value,
        page,
        size: 100,
        active: statusFilter.value === 'ACTIVE' ? true : statusFilter.value === 'INACTIVE' ? false : undefined,
        custom: statusFilter.value === 'CUSTOM' ? true : undefined,
      },
    }),
  ({ data }) => {
    specs.value = data.items.map(boxStockRow)
    counts.value = data.counts
    summary.value = data.summary
    return data.totalPages
  },
)
// 규격 모달의 드롭다운 선택지. 재질은 센터와 무관한 고정 목록이라 /box-materials 를 씁니다.
function loadOptions() {
  return report(async () => {
    const [{ data: suppliers }, { data: materials }] = await Promise.all([
      warehouseApi('/suppliers'),
      api('/box-materials'),
    ])
    supplierOptions.value = [
      { value: '', label: '미지정' },
      ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
    ]
    materialOptions.value = materials.map((material) => ({ value: material.code, label: material.label }))
  })
}
onMounted(loadOptions)
function openCreate() {
  formModal.value = { spec: null }
}
function openEdit(spec) {
  formModal.value = { spec }
}
function handleSave(form) {
  return run(async () => {
    const dims = toDimensions(form)
    if (
      !form.code.trim() ||
      !form.sizeName.trim() ||
      !dims.every(isPositiveInt) ||
      !isNonNegativeInt(form.unitPriceKrw)
    )
      throw new Error('규격명·사이즈명, 양수 정수 치수와 0 이상 단가를 입력하세요.')
    const target = formModal.value.spec
    const safetyQty = form.safetyQty === '' ? null : Number(form.safetyQty)
    const targetQty = form.targetQty === '' ? null : Number(form.targetQty)
    if ([safetyQty, targetQty].some((value) => value != null && (!Number.isInteger(value) || value < 0)))
      throw new Error('안전 재고와 목표 재고는 0 이상의 정수로 입력해 주세요.')
    const body = {
      code: form.code.trim(),
      name: form.sizeName.trim(),
      // 크기 분류(sizeClass)는 서버가 내경으로 정합니다. 보내면 400입니다.
      innerWidthMm: dims[0],
      innerDepthMm: dims[1],
      innerHeightMm: dims[2],
      material: form.material,
      supplierId: form.supplier || undefined,
      unitPriceKrw: Number(form.unitPriceKrw),
      isCustom: form.kind === 'custom',
      isActive: form.inUse,
      description: form.description,
    }
    if (target) body.expectedVersion = target.version
    else {
      body.initialOnHandQty = Number(form.initialOnHandQty)
      if (safetyQty != null) body.safetyQty = safetyQty
      if (targetQty != null) body.targetQty = targetQty
    }
    const { data: saved } = await warehouseApi(target ? `/box-specs/${target.id}` : '/box-specs', {
      method: target ? 'PATCH' : 'POST',
      body,
    })
    // 자동 계산값을 그대로 저장해 고정 수량으로 바꾸지 않는다. 직접 입력한 값이 달라진 경우만 저장한다.
    if (target) {
      const policy = { expectedVersion: saved.version }
      if (safetyQty !== (target.configuredSafetyQty ?? null)) {
        if (safetyQty == null) policy.safetyDays = target.stock?.safetyDays ?? 7
        else policy.safetyQty = safetyQty
      }
      if (targetQty !== (target.configuredTargetQty ?? null)) {
        if (targetQty == null) policy.automaticTarget = true
        else policy.targetQty = targetQty
      }
      if (Object.keys(policy).length > 1)
        await warehouseApi(`/box-inventories/${target.id}/policy`, { method: 'PATCH', body: policy })
    }
    formModal.value = null
    await refresh()
  }, '박스 규격이 저장되었습니다.')
}
function requestDelete() {
  return run(async () => {
    await warehouseApi(`/box-specs/${deletingSpec.value.id}`, {
      method: 'DELETE',
      query: { expectedVersion: deletingSpec.value.version },
    })
    deletingSpec.value = null
    await refresh()
  }, '규격이 삭제되었습니다.')
}
function handleStockInSubmit(form) {
  return run(async () => {
    if (!isPositiveInt(form.quantity)) throw new Error('입고 수량은 양수 정수로 입력해 주세요.')
    const qty = Number(form.quantity)
    const target = specs.value.find((item) => item.id === form.specId)
    await warehouseApi('/inventory-receipts', {
      method: 'POST',
      body: {
        requestId: form.requestId,
        boxSpecId: form.specId,
        expectedVersion: target.version,
        purchaseOrderId: form.orderNumber || undefined,
        qty,
        receivedDate: form.receivedAt,
        memo: form.memo || undefined,
      },
    })
    stockInSpec.value = null
    await refresh()
  }, '입고가 등록되었습니다.')
}
</script>

<template>
  <div class="box-management">
    <PageHeader title="박스 재고/규격 관리" description="택배 상자 규격 정보와 규격별 재고를 함께 확인하고 관리합니다.">
      <template #actions>
        <AppButton variant="primary" :disabled="!auth.canEdit.value" @click="openCreate">+ 규격 추가</AppButton>
      </template>
    </PageHeader>

    <ApiState :error="error" @retry="refresh" />

    <StatGrid :stats="inventoryStats" band />

    <FilterBar>
      <SearchInput v-model="keyword" width="320px" placeholder="규격명 · 사이즈명 검색" aria-label="박스 규격 검색" />
      <template #aside>{{ specSummary }}</template>

      <template #second>
        <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="규격 사용 여부" />
      </template>
    </FilterBar>

    <DataTable
      :columns="columns"
      :rows="specs"
      row-key="id"
      min-width="1440px"
      :loading="loading"
      empty-text="조건에 맞는 규격이 없습니다."
    >
      <template #cell-code="{ row }">
        <span class="spec-code">
          <span class="spec-code__name">
            <strong>{{ row.code }}</strong>
            <span v-if="row.custom" class="spec-code__star" title="자체 제작 규격" aria-label="자체 제작 규격">★</span>
          </span>
          <span class="spec-code__size">{{ row.sizeName }}</span>
        </span>
      </template>

      <template #cell-current="{ row }">
        <strong v-if="row.onHandQty != null">{{ row.current }}</strong>
        <span v-else class="cell--empty">—</span>
      </template>

      <template #cell-safety="{ row }">
        <span
          :class="{ 'cell--empty': row.safetyQty == null }"
          :title="
            row.safetyQty == null
              ? '예상 사용량 근거가 없어 계산할 수 없습니다.'
              : row.configuredSafetyQty == null
                ? `${row.stock.safetyDays}일분 자동 계산`
                : '직접 설정한 수량'
          "
          >{{ row.safetyQty == null ? '계산 불가' : row.safety }}</span
        >
      </template>

      <template #cell-level="{ row }">
        <div
          v-if="row.level != null"
          class="level"
          :title="`현재 ${number(row.onHandQty)}개 / 목표 ${number(row.stock.targetQty)}개`"
        >
          <ProgressBar :value="row.level" :tone="TONE_BY_STOCK[row.stockStatus]" :label="`${row.code} 재고 수준`" />
          <span class="level__value">{{ row.level }}%</span>
        </div>
        <span v-else class="cell--empty">{{ row.stock.targetQty === 0 ? '사용 계획 없음' : '계산 불가' }}</span>
      </template>

      <template #cell-linkedProducts="{ row }">
        <span :class="{ 'cell--empty': row.linkedProducts === 0 }">{{ row.linkedProducts }}개</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.statusLabel" />
      </template>

      <!-- 설명이 길어도 줄 높이가 늘지 않도록 한 줄로 자릅니다. 전문은 마우스를 올리면 보입니다. -->
      <template #cell-description="{ row }">
        <span class="spec-description" :title="row.description">{{ row.description }}</span>
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton size="sm" :disabled="!auth.canEdit.value" @click="openEdit(row)">수정</AppButton>
          <!-- 연결 상품이 있는 규격은 삭제할 수 없어 미사용 규격에만 삭제 버튼을 둡니다. -->
          <AppButton
            v-if="!row.isActive"
            size="sm"
            variant="danger-outline"
            :disabled="!auth.canEdit.value"
            @click="deletingSpec = row"
          >
            삭제
          </AppButton>
          <AppButton size="sm" :disabled="!auth.canEdit.value || row.onHandQty == null" @click="stockInSpec = row">
            입고
          </AppButton>
        </div>
      </template>
    </DataTable>

    <div class="box-management__footnotes">
      <p class="box-management__footnote">
        <span class="box-management__footnote-star" aria-hidden="true">★</span>
        우리 물류센터에서 자체 제작한 박스 규격이에요. 표시가 없는 규격은 시중 표준 규격(택배 박스 호수 기준)입니다.
      </p>
      <p class="box-management__footnote box-management__footnote--plain">
        박스 규격을 수정하면 연결된 상품의 매칭 적합 여부와 비율이 다시 계산됩니다.
      </p>
    </div>

    <Pagination v-if="totalPages > 1" v-model="page" :total-pages="totalPages" />
    <BoxSpecFormModal
      v-if="formModal"
      :spec="formModal.spec"
      :suppliers="supplierOptions"
      :materials="materialOptions"
      :busy="saving"
      @close="formModal = null"
      @save="handleSave"
    />

    <BoxSpecDeleteModal
      v-if="deletingSpec"
      :spec="deletingSpec"
      @close="deletingSpec = null"
      @confirm="requestDelete"
    />

    <StockInModal
      v-if="stockInSpec"
      :spec="stockInSpec"
      :busy="saving"
      @close="stockInSpec = null"
      @submit="handleStockInSubmit"
    />

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
/* 규격명: 첫 줄에 규격 코드(+자체 제작 표시), 둘째 줄에 크기 이름. 각 줄은 줄바꿈하지 않습니다. */
.spec-code {
  display: inline-grid;
  gap: 2px;
  white-space: nowrap;
}

.spec-code__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* 간단 설명: 칸 너비(240px)에서 좌우 여백을 뺀 만큼만 쓰고 넘치면 말줄임표 */
.spec-description {
  display: block;
  max-width: 204px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spec-code__size {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.level {
  display: flex;
  align-items: center;
  gap: 10px;
}

.level :deep(.progress-bar) {
  width: 90px;
  flex: none;
}

.level__value {
  font-size: 13px;
  font-weight: 600;
}

.spec-code__star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-cream-strong);
  color: var(--color-gold);
  font-size: 9px;
  line-height: 1;
}

.box-management__footnotes {
  margin-top: 16px;
}

.box-management__footnote {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: keep-all;
}

.box-management__footnote--plain {
  margin-top: 12px;
  color: var(--color-text-muted);
}

.box-management__footnote-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex: none;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--color-cream-strong);
  color: var(--color-gold);
  font-size: 10px;
  line-height: 1;
}
</style>
