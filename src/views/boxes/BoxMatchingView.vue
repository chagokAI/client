<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import ApiState from '@/components/common/ApiState.vue'
import DataTable from '@/components/common/DataTable.vue'
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
import { MATCH, productRow } from '@/api/adapters'
import { useRemote } from '@/composables/useRemote'

const searchField = ref('name'), keyword = ref(''), category = ref('all'), statusFilter = ref('all'), sort = ref('fill-desc'), page = ref(1)
const products = ref([]), totalPages = ref(0), counts = ref({}), categories = ref([])
const editingProduct = ref(null), deletingProduct = ref(null), toastMessage = ref(''), saving = ref(false)
const { loading, error, load } = useRemote()
const productSearchFields = [{ value: 'name', label: '상품명' }, { value: 'code', label: '상품코드' }]
const matchSortOptions = [{ value: 'fill-desc', label: '포장공간비율 높은 순' }, { value: 'fill-asc', label: '포장공간비율 낮은 순' }, { value: 'name', label: '상품명 순' }]
const productCategories = computed(() => [{ value: 'all', label: '카테고리: 전체' }, ...categories.value])
const statusOptions = computed(() => [{ value: 'all', label: '전체', count: counts.value.ALL ?? 0 }, ...Object.entries(MATCH).map(([value, label]) => ({ value, label, count: counts.value[value] ?? 0 }))])
const rows = computed(() => products.value)
const columns = [
  { key: 'name', label: '상품명 / 상품코드', width: '22%' }, { key: 'category', label: '카테고리', width: '10%' },
  { key: 'size', label: '사이즈 (가로 × 세로 × 높이)', width: '16%' }, { key: 'matchedBox', label: '매칭 택배 상자 규격', width: '14%' },
  { key: 'fillRate', label: '포장공간비율', width: '14%' }, { key: 'status', label: '상태', width: '10%' }, { key: 'actions', label: '관리', width: '12%' },
]
function refresh() {
  return load(signal => warehouseApi('/product-matches', { signal, query: { searchBy: searchField.value.toUpperCase(), keyword: keyword.value,
    categoryId: category.value === 'all' ? undefined : category.value, status: statusFilter.value === 'all' ? undefined : statusFilter.value,
    page: page.value - 1, sort: ({ 'fill-desc': 'fillRatePct,desc', 'fill-asc': 'fillRatePct,asc', name: 'name,asc' })[sort.value] } }),
  ({ data }) => { products.value = data.items.map(productRow); counts.value = data.counts ?? {}; totalPages.value = data.totalPages })
}
watch([searchField, keyword, category, statusFilter, sort], () => { if (page.value !== 1) page.value = 1; else refresh() })
watch(page, refresh)
onMounted(async () => {
  refresh()
  try { const { data } = await warehouseApi('/categories'); categories.value = data.map(c => ({ value: c.id, label: c.name })) }
  catch (cause) { toastMessage.value = cause.message }
})
function fillTone(value) { return value >= 85 ? 'info' : 'warning' }
async function openEdit(row) {
  try { const { data } = await warehouseApi(`/products/${row.id}`); editingProduct.value = productRow(data) }
  catch (cause) { toastMessage.value = cause.message }
}
async function handleSave(form) {
  if (saving.value) return
  saving.value = true
  try {
    const dimensions = [form.width, form.depth, form.height].map(Number)
    if (!form.name.trim() || dimensions.some(v => !Number.isInteger(v) || v <= 0)) throw new Error('상품명과 양수 정수 치수를 입력해 주세요.')
    await warehouseApi(`/products/${editingProduct.value.id}`, { method: 'PATCH', body: {
      expectedVersion: editingProduct.value.version, name: form.name.trim(), categoryId: form.category || undefined,
      widthMm: dimensions[0], depthMm: dimensions[1], heightMm: dimensions[2], weightG: form.weight === '' ? undefined : Number(form.weight),
      boxSpecId: form.matchedBoxId || undefined, matchOverrideReason: form.manualReason || undefined,
    } })
    editingProduct.value = null; toastMessage.value = '상품 정보가 저장되었습니다.'; await refresh()
  } catch (cause) { toastMessage.value = cause.message }
  finally { saving.value = false }
}
async function deactivate(target) {
  if (saving.value) return
  saving.value = true
  try { await warehouseApi(`/products/${target.id}`, { method: 'DELETE', query: { expectedVersion: target.version } });
    editingProduct.value = null; deletingProduct.value = null; toastMessage.value = '상품이 비활성화되었습니다.'; await refresh()
  } catch (cause) { toastMessage.value = cause.message }
  finally { saving.value = false }
}
function handleDeactivate() { return deactivate(editingProduct.value) }
function handleDelete() { return deactivate(deletingProduct.value) }
</script>

<template>
  <div class="box-matching">
    <PageHeader
      title="물품-박스 매칭 현황"
      description="상품 규격을 분석하고 가장 알맞은 택배 상자를 매칭합니다."
    />

    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <div class="box-matching__filters">
      <div class="box-matching__search">
        <SelectField
          v-model="searchField"
          :options="productSearchFields"
          width="110px"
          aria-label="검색 기준"
        />
        <SearchInput
          v-model="keyword"
          class="box-matching__keyword"
          placeholder="상품명 또는 상품코드를 입력하세요"
          aria-label="상품 검색"
        />
      </div>

      <SelectField v-model="category" :options="productCategories" width="170px" aria-label="카테고리" />

      <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="매칭 상태" />

      <SelectField
        v-model="sort"
        class="box-matching__sort"
        :options="matchSortOptions"
        width="180px"
        aria-label="정렬 기준"
      />
    </div>

    <DataTable :columns="columns" :rows="rows" row-key="id" empty-text="조건에 맞는 상품이 없습니다.">
      <template #cell-name="{ row }">
        <div class="product">
          <span class="product__thumbnail" aria-hidden="true" />
          <div>
            <p class="product__name">{{ row.name }}</p>
            <p class="product__code">{{ row.code }}</p>
          </div>
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
        <StatusBadge :label="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton size="sm" :disabled="!auth.canEdit.value" @click="openEdit(row)">수정</AppButton>
          <AppButton size="sm" variant="danger-outline" :disabled="!auth.canEdit.value" @click="deletingProduct = row">삭제</AppButton>
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
.box-matching__filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.box-matching__search {
  display: flex;
  align-items: center;
  gap: 0;
  flex: 1;
  min-width: 280px;
  max-width: 420px;
}

.box-matching__search :deep(.select-field__control) {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.box-matching__keyword {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-left: 0;
}

.box-matching__sort {
  margin-left: auto;
}

.product {
  display: flex;
  align-items: center;
  gap: 10px;
}

.product__thumbnail {
  width: 28px;
  height: 28px;
  flex: none;
  border-radius: var(--radius-sm);
  background: var(--color-cream-strong);
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

.cell--empty {
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.box-matching__pagination {
  margin-top: 24px;
}
</style>
