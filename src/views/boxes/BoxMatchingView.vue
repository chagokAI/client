<script setup>
import { computed, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import ApiState from '@/components/common/ApiState.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterBar from '@/components/common/FilterBar.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import Pagination from '@/components/common/Pagination.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SelectField from '@/components/common/SelectField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ProductDeleteModal from './ProductDeleteModal.vue'
import ProductEditModal from './ProductEditModal.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { MATCH, fillTone } from '@/api/format'
import { productRow } from '@/api/rows'
import { isPositiveInt, toDimensions } from '@/api/validate'
import { useListQuery } from '@/composables/useListQuery'
import { useSaveAction } from '@/composables/useSaveAction'

const searchField = ref('name'),
  keyword = ref(''),
  category = ref('all'),
  statusFilter = ref('all'),
  sort = ref('fill-desc')
const products = ref([]),
  counts = ref({}),
  categories = ref([])
const editingProduct = ref(null),
  deletingProduct = ref(null)
const { saving, toastMessage, run, report } = useSaveAction()
const productSearchFields = [
  { value: 'name', label: '상품명' },
  { value: 'code', label: '상품코드' },
]
const matchSortOptions = [
  { value: 'fill-desc', label: '포장공간비율 높은 순' },
  { value: 'fill-asc', label: '포장공간비율 낮은 순' },
  { value: 'name', label: '상품명 순' },
]
const productCategories = computed(() => [{ value: 'all', label: '전체' }, ...categories.value])
const statusOptions = computed(() => [
  { value: 'all', label: '전체', count: counts.value.ALL ?? 0 },
  ...Object.entries(MATCH).map(([value, label]) => ({ value, label, count: counts.value[value] ?? 0 })),
])
const columns = [
  { key: 'name', label: '상품명 / 상품코드', width: '22%', align: 'left' },
  { key: 'category', label: '카테고리', width: '10%', align: 'left' },
  { key: 'size', label: '사이즈 (가로 × 세로 × 높이)', width: '16%' },
  { key: 'matchedBox', label: '매칭 택배 상자 규격', width: '14%' },
  { key: 'fillRate', label: '포장공간비율', width: '14%' },
  { key: 'status', label: '상태', width: '10%' },
  { key: 'actions', label: '관리', width: '12%' },
]
const { loading, error, page, totalPages, refresh } = useListQuery(
  [searchField, keyword, category, statusFilter, sort],
  (signal, page) =>
    warehouseApi('/product-matches', {
      signal,
      query: {
        searchBy: searchField.value.toUpperCase(),
        keyword: keyword.value,
        categoryId: category.value === 'all' ? undefined : category.value,
        status: statusFilter.value === 'all' ? undefined : statusFilter.value,
        page,
        size: 10,
        sort: { 'fill-desc': 'fillRatePct,desc', 'fill-asc': 'fillRatePct,asc', name: 'name,asc' }[sort.value],
      },
    }),
  ({ data }) => {
    products.value = data.items.map(productRow)
    counts.value = data.counts ?? {}
    return data.totalPages
  },
)
onMounted(() =>
  report(async () => {
    const { data } = await warehouseApi('/categories')
    categories.value = data.map((c) => ({ value: c.id, label: c.name }))
  }),
)
function openEdit(row) {
  return report(async () => {
    const { data } = await warehouseApi(`/products/${row.id}`)
    editingProduct.value = productRow(data)
  })
}
function handleSave(form) {
  return run(async () => {
    const dimensions = toDimensions(form)
    if (!form.name.trim() || !dimensions.every(isPositiveInt))
      throw new Error('상품명과 양수 정수 치수를 입력해 주세요.')
    await warehouseApi(`/products/${editingProduct.value.id}`, {
      method: 'PATCH',
      body: {
        expectedVersion: editingProduct.value.version,
        name: form.name.trim(),
        categoryId: form.category || undefined,
        widthMm: dimensions[0],
        depthMm: dimensions[1],
        heightMm: dimensions[2],
        weightG: form.weight === '' ? undefined : Number(form.weight),
        boxSpecId: form.matchedBoxId || undefined,
      },
    })
    editingProduct.value = null
    await refresh()
  }, '상품 정보가 저장되었습니다.')
}
function deactivate(target) {
  return run(async () => {
    await warehouseApi(`/products/${target.id}`, { method: 'DELETE', query: { expectedVersion: target.version } })
    editingProduct.value = null
    deletingProduct.value = null
    await refresh()
  }, '상품이 비활성화되었습니다.')
}
function handleDeactivate() {
  return deactivate(editingProduct.value)
}
function handleDelete() {
  return deactivate(deletingProduct.value)
}

function recalculate() {
  return run(async () => {
    await warehouseApi('/product-matches/recalculate', {
      method: 'POST',
      query: { refreshExisting: true },
      body: {},
    })
    await refresh()
  }, '현재 활성 박스 기준으로 매칭을 갱신했습니다.')
}
</script>

<template>
  <div class="box-matching">
    <PageHeader
      title="물품-박스 매칭 현황"
      description="현재 활성 박스 중 치수에 맞고 포장공간비율이 가장 높은 규격을 추천합니다."
    >
      <template #actions>
        <AppButton :disabled="saving || !auth.canEdit.value" @click="recalculate">매칭 갱신</AppButton>
      </template>
    </PageHeader>

    <ApiState :error="error" @retry="refresh" />
    <FilterBar>
      <SelectField v-model="category" :options="productCategories" width="170px" label="카테고리" />

      <div class="box-matching__search">
        <SelectField v-model="searchField" :options="productSearchFields" width="110px" aria-label="검색 기준" />
        <SearchInput
          v-model="keyword"
          class="box-matching__keyword"
          placeholder="상품명 또는 상품코드를 입력하세요"
          aria-label="상품 검색"
        />
      </div>

      <template #second>
        <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="매칭 상태" />
        <SelectField
          v-model="sort"
          class="box-matching__sort"
          :options="matchSortOptions"
          width="180px"
          aria-label="정렬 기준"
        />
      </template>
    </FilterBar>

    <DataTable
      :columns="columns"
      :rows="products"
      row-key="id"
      :loading="loading"
      empty-text="조건에 맞는 상품이 없습니다."
    >
      <template #cell-name="{ row }">
        <div class="product">
          <p class="product__name">{{ row.name }}</p>
          <p class="product__code">{{ row.code }}</p>
        </div>
      </template>

      <template #cell-matchedBox="{ row }">
        <span :class="{ 'cell--empty': !row.matchedBox }">{{ row.matchedBox ?? '—' }}</span>
      </template>

      <template #cell-fillRate="{ row }">
        <div v-if="row.fillRate !== null" class="fill-rate">
          <ProgressBar :value="row.fillRate" :tone="fillTone(row.fillRate)" :label="`${row.name} 포장공간비율`" />
          <span class="fill-rate__value">{{ row.fillRate.toFixed(1) }}%</span>
        </div>
        <span v-else class="cell--empty">—</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.statusLabel" />
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton size="sm" :disabled="!auth.canEdit.value" @click="openEdit(row)">수정</AppButton>
          <AppButton size="sm" variant="danger-outline" :disabled="!auth.canEdit.value" @click="deletingProduct = row"
            >삭제</AppButton
          >
        </div>
      </template>
    </DataTable>

    <Pagination v-model="page" class="box-matching__pagination" :total-pages="totalPages" />

    <ProductEditModal
      v-if="editingProduct"
      :product="editingProduct"
      :categories="categories"
      :busy="saving"
      @close="editingProduct = null"
      @save="handleSave"
      @deactivate="handleDeactivate"
    />

    <ProductDeleteModal
      v-if="deletingProduct"
      :product="deletingProduct"
      @close="deletingProduct = null"
      @confirm="handleDelete"
    />

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.box-matching__search {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  min-width: 280px;
  max-width: 520px;
}

.box-matching__search :deep(.select-field__control) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

/* 검색 기준 선택과 입력창을 한 덩어리처럼 붙여 보여 줍니다. ([검색] 버튼은 떨어뜨립니다) */
.box-matching__keyword {
  flex: 1;
  min-width: 0;
}

.box-matching__keyword :deep(.search-input__control) {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 0;
}

.box-matching__sort {
  margin-left: auto;
}

.product__name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.4;
}

.product__code {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.fill-rate {
  display: flex;
  align-items: center;
  gap: 10px;
}

.fill-rate :deep(.progress-bar) {
  width: 78px;
  flex: none;
}

.fill-rate__value {
  font-size: 13px;
  font-weight: 600;
}

.box-matching__pagination {
  margin-top: 24px;
}
</style>
