<script setup>
import { computed, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import BoxSpecDeleteBlockedModal from './BoxSpecDeleteBlockedModal.vue'
import BoxSpecDeleteModal from './BoxSpecDeleteModal.vue'
import BoxSpecFormModal from './BoxSpecFormModal.vue'
import { boxSpecs, specSummary } from '@/mocks/boxes'
import { openPurchaseOrderOptions } from '@/mocks/orders'

const keyword = ref('')
const statusFilter = ref('all')
const specs = ref(boxSpecs.map((item) => ({ ...item })))

// 열려 있는 모달 상태. editingSpec이 null이면 신규 등록입니다.
const formModal = ref(null)
const deletingSpec = ref(null)
const blockedSpec = ref(null)
const toastMessage = ref('')

// 진행 중인 발주서에 들어 있는 규격은 삭제할 수 없습니다.
function openOrderFor(spec) {
  return openPurchaseOrderOptions.find((order) => order.specIds.includes(spec.id))?.value ?? ''
}

function canDelete(spec) {
  return spec.status === '미사용' && spec.linkedProducts === 0 && !openOrderFor(spec)
}

// 삭제 확인 모달에서 한 번 더 조건을 검사합니다.
// 다른 담당자가 그 사이 규격을 사용 중으로 바꿨을 수 있어서입니다.
function requestDelete() {
  const target = deletingSpec.value
  if (!canDelete(target)) {
    deletingSpec.value = null
    blockedSpec.value = target
    return
  }
  handleDelete()
}

const columns = [
  { key: 'code', label: '박스 규격명', width: '10%' },
  { key: 'sizeName', label: '박스 사이즈명', width: '10%' },
  { key: 'dimensions', label: '내경 사이즈 (가로 × 세로 × 높이)', width: '17%' },
  { key: 'material', label: '재질', width: '10%' },
  { key: 'supplier', label: '공급사', width: '11%' },
  { key: 'description', label: '간단 설명', width: '20%' },
  { key: 'linkedProducts', label: '연결 상품', width: '8%' },
  { key: 'status', label: '사용 여부', width: '8%' },
  { key: 'actions', label: '관리', width: '12%' },
]

const statusOptions = computed(() => [
  { value: 'all', label: '전체', count: specs.value.length },
  { value: '사용 중', label: '사용 중', count: specs.value.filter((item) => item.status === '사용 중').length },
  { value: '미사용', label: '미사용', count: specs.value.filter((item) => item.status === '미사용').length },
  { value: 'custom', label: '★ 커스텀', count: specs.value.filter((item) => item.custom).length },
])

const rows = computed(() => {
  const trimmed = keyword.value.trim().toLowerCase()

  return specs.value.filter((item) => {
    if (statusFilter.value === 'custom' && !item.custom) return false
    if (statusFilter.value !== 'all' && statusFilter.value !== 'custom' && item.status !== statusFilter.value) {
      return false
    }
    if (!trimmed) return true
    return `${item.code} ${item.sizeName}`.toLowerCase().includes(trimmed)
  })
})

function openCreate() {
  formModal.value = { spec: null }
}

function openEdit(spec) {
  formModal.value = { spec }
}

function handleSave() {
  // TODO: 저장 API 응답으로 목록을 갱신합니다.
  const isEditing = Boolean(formModal.value?.spec)
  toastMessage.value = isEditing ? '박스 규격이 수정되었습니다.' : '새 박스 규격이 등록되었습니다.'
  formModal.value = null
}

function handleDelete() {
  specs.value = specs.value.filter((item) => item.id !== deletingSpec.value.id)
  toastMessage.value = `${deletingSpec.value.code} 규격이 삭제되었습니다.`
  deletingSpec.value = null
}
</script>

<template>
  <div class="box-spec">
    <!-- '+ 규격 추가'는 페이지 제목 줄에 붙습니다. 부모 뷰가 만든 자리에 끼워 넣습니다. -->
    <Teleport defer to="#box-management-actions">
      <AppButton variant="primary" @click="openCreate">+ 규격 추가</AppButton>
    </Teleport>

    <div class="box-spec__filters">
      <SearchInput
        v-model="keyword"
        width="320px"
        placeholder="규격명 · 사이즈명 검색"
        aria-label="박스 규격 검색"
      />
      <FilterChips v-model="statusFilter" :options="statusOptions" aria-label="규격 사용 여부" />
      <span class="box-spec__summary">{{ specSummary }}</span>
    </div>

    <DataTable :columns="columns" :rows="rows" row-key="id" empty-text="조건에 맞는 규격이 없습니다.">
      <template #cell-code="{ row }">
        <span class="spec-code">
          <strong>{{ row.code }}</strong>
          <span v-if="row.custom" class="spec-code__star" title="자체 제작 규격" aria-label="자체 제작 규격">★</span>
        </span>
      </template>

      <template #cell-linkedProducts="{ row }">
        <span :class="{ 'cell--empty': row.linkedProducts === 0 }">{{ row.linkedProducts }}개</span>
      </template>

      <template #cell-status="{ row }">
        <StatusBadge :label="row.status" />
      </template>

      <template #cell-actions="{ row }">
        <div class="row-actions">
          <AppButton size="sm" @click="openEdit(row)">수정</AppButton>
          <!-- 연결 상품이 있는 규격은 삭제할 수 없어 미사용 규격에만 삭제 버튼을 둡니다. -->
          <AppButton
            v-if="row.status === '미사용'"
            size="sm"
            variant="danger-outline"
            @click="deletingSpec = row"
          >
            삭제
          </AppButton>
        </div>
      </template>
    </DataTable>

    <div class="box-spec__footnotes">
      <p class="box-spec__footnote">
        <span class="box-spec__footnote-star" aria-hidden="true">★</span>
        우리 물류센터에서 자체 제작한 박스 규격이에요. 표시가 없는 규격은 시중 표준 규격(택배 박스 호수 기준)입니다.
      </p>
      <p class="box-spec__footnote box-spec__footnote--plain">
        박스 규격을 수정하면 연결된 상품의 매칭 결과와 재고 기준이 다시 계산됩니다.
      </p>
    </div>

    <BoxSpecFormModal
      v-if="formModal"
      :spec="formModal.spec"
      @close="formModal = null"
      @save="handleSave"
    />

    <BoxSpecDeleteModal
      v-if="deletingSpec"
      :spec="deletingSpec"
      @close="deletingSpec = null"
      @confirm="requestDelete"
    />

    <BoxSpecDeleteBlockedModal
      v-if="blockedSpec"
      :spec="blockedSpec"
      :open-order-number="openOrderFor(blockedSpec)"
      @close="blockedSpec = null"
      @view-products="$router.push('/boxes/matching')"
    />

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.box-spec__filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.box-spec__summary {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.spec-code {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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

.cell--empty {
  color: var(--color-text-muted);
}

.row-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.box-spec__footnotes {
  margin-top: 16px;
}

.box-spec__footnote {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: keep-all;
}

.box-spec__footnote--plain {
  margin-top: 12px;
  color: var(--color-text-muted);
}

.box-spec__footnote-star {
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
