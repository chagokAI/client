<script setup>
import { computed, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import Pagination from '@/components/common/Pagination.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import SelectField from '@/components/common/SelectField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ProductDeleteModal from './ProductDeleteModal.vue'
import ProductEditModal from './ProductEditModal.vue'
import {
  matchFilterCounts,
  matchSortOptions,
  matchTotalPages,
  productCategories,
  productMatches,
  productSearchFields,
} from '@/mocks/boxes'

const searchField = ref('name')
const keyword = ref('')
const category = ref('all')
const statusFilter = ref('all')
const sort = ref('fill-desc')
const page = ref(1)
const products = ref(productMatches.map((item) => ({ ...item })))

const editingProduct = ref(null)
const deletingProduct = ref(null)
const toastMessage = ref('')

const columns = [
  { key: 'name', label: '상품명 / 상품코드', width: '22%' },
  { key: 'category', label: '카테고리', width: '10%' },
  { key: 'size', label: '사이즈 (가로 × 세로 × 높이)', width: '16%' },
  { key: 'matchedBox', label: '매칭 택배 상자 규격', width: '14%' },
  { key: 'fillRate', label: '포장공간비율', width: '14%' },
  { key: 'status', label: '상태', width: '10%' },
  { key: 'actions', label: '관리', width: '12%' },
]

const statusOptions = computed(() => [
  { value: 'all', label: '전체', count: matchFilterCounts.total },
  { value: '매칭 완료', label: '매칭 완료', count: matchFilterCounts.matched },
  { value: '검토 필요', label: '검토 필요', count: matchFilterCounts.review },
  { value: '미매칭', label: '미매칭', count: matchFilterCounts.unmatched },
])

const rows = computed(() => {
  const trimmed = keyword.value.trim().toLowerCase()

  return products.value.filter((item) => {
    if (statusFilter.value !== 'all' && item.status !== statusFilter.value) return false
    if (category.value !== 'all' && item.category !== category.value) return false
    if (!trimmed) return true
    return String(item[searchField.value]).toLowerCase().includes(trimmed)
  })
})

// 포장공간비율은 85% 이상이면 정상, 그 아래는 확인이 필요한 구간입니다.
function fillTone(value) {
  return value >= 85 ? 'info' : 'warning'
}

function handleSave() {
  // TODO: 저장 API 응답으로 목록을 갱신합니다.
  toastMessage.value = `${editingProduct.value.name} 상품 정보가 저장되었습니다.`
  editingProduct.value = null
}

function handleDeactivate() {
  toastMessage.value = `${editingProduct.value.name} 상품을 비활성화했습니다.`
  editingProduct.value = null
}

function handleDelete() {
  products.value = products.value.filter((item) => item.id !== deletingProduct.value.id)
  toastMessage.value = `${deletingProduct.value.name} 상품이 삭제되었습니다.`
  deletingProduct.value = null
}
</script>

<template>
  <div class="box-matching">
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
          <AppButton size="sm" @click="editingProduct = row">수정</AppButton>
          <AppButton size="sm" variant="danger-outline" @click="deletingProduct = row">삭제</AppButton>
        </div>
      </template>
    </DataTable>

    <Pagination v-model="page" class="box-matching__pagination" :total-pages="matchTotalPages" />

    <ProductEditModal
      v-if="editingProduct"
      :product="editingProduct"
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
