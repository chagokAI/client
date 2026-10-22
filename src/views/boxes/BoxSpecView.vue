<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import SearchInput from '@/components/common/SearchInput.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import BoxSpecDeleteModal from './BoxSpecDeleteModal.vue'
import BoxSpecFormModal from './BoxSpecFormModal.vue'
import ApiState from '@/components/common/ApiState.vue'
import Pagination from '@/components/common/Pagination.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { specRow, number } from '@/api/adapters'
import { useRemote } from '@/composables/useRemote'
const keyword = ref(''), statusFilter = ref('all'), page = ref(1), totalPages = ref(0)
const specs = ref([]), counts = ref({}), summary = ref(null)
const formModal = ref(null), deletingSpec = ref(null), toastMessage = ref(''), saving = ref(false)
const { loading, error, load } = useRemote()
const columns = [
  { key: 'code', label: '박스 규격명', width: '10%' }, { key: 'sizeName', label: '박스 사이즈명', width: '10%' },
  { key: 'dimensions', label: '내경 사이즈 (가로 × 세로 × 높이)', width: '17%' }, { key: 'material', label: '재질', width: '10%' },
  { key: 'supplier', label: '공급사', width: '11%' }, { key: 'description', label: '간단 설명', width: '20%' },
  { key: 'linkedProducts', label: '연결 상품', width: '8%' }, { key: 'status', label: '사용 여부', width: '8%' }, { key: 'actions', label: '관리', width: '12%' },
]
const statusOptions = computed(() => [{ value: 'all', label: '전체', count: counts.value.ALL ?? 0 }, { value: 'ACTIVE', label: '사용 중', count: counts.value.ACTIVE ?? 0 },
  { value: 'INACTIVE', label: '미사용', count: counts.value.INACTIVE ?? 0 }, { value: 'CUSTOM', label: '★ 커스텀', count: counts.value.CUSTOM ?? 0 }])
const rows = computed(() => specs.value)
const specSummary = computed(() => `총 ${number(summary.value?.totalSpecCount)}개 규격 · 표준 ${number(summary.value?.standardSpecCount)} · 커스텀 ${number(summary.value?.customSpecCount)}`)
const supplierOptions = ref([{ value: '', label: '미지정' }])
function refresh() {
  return load(signal => warehouseApi('/box-specs', { signal, query: { keyword: keyword.value, page: page.value - 1, size: 100,
    active: statusFilter.value === 'ACTIVE' ? true : statusFilter.value === 'INACTIVE' ? false : undefined,
    custom: statusFilter.value === 'CUSTOM' ? true : undefined } }), ({ data }) => {
      specs.value = data.items.map(specRow); counts.value = data.counts; summary.value = data.summary; totalPages.value = data.totalPages
    })
}
async function loadSuppliers() {
  // 공급사 조회 API 연결 전에는 저장된 규격의 공급사만 선택할 수 있다.
  try { const { data } = await warehouseApi('/box-specs', { query: { size: 100 } });
    const suppliers = new Map(data.items.filter(b => b.supplier).map(b => [b.supplier.id, { value: b.supplier.id, label: b.supplier.name }]))
    supplierOptions.value = [{ value: '', label: '미지정' }, ...suppliers.values()]
  } catch (cause) { toastMessage.value = cause.message }
}
watch([keyword, statusFilter], () => { if (page.value !== 1) page.value = 1; else refresh() }); watch(page, refresh)
onMounted(() => { refresh(); loadSuppliers() })
function openCreate() { formModal.value = { spec: null } }
function openEdit(spec) { formModal.value = { spec } }
async function handleSave(form) {
  if (saving.value) return
  saving.value = true
  try {
    const dims = [form.width, form.depth, form.height].map(Number)
    if (!form.code.trim() || !form.sizeName.trim() || dims.some(v => !Number.isInteger(v) || v <= 0) || !Number.isInteger(Number(form.unitPriceKrw)) || Number(form.unitPriceKrw) < 0)
      throw new Error('규격명·사이즈명, 양수 정수 치수와 0 이상 단가를 입력하세요.')
    const target = formModal.value.spec
    const body = { code: form.code.trim(), name: form.sizeName.trim(), sizeClass: form.sizeClass,
      innerWidthMm: dims[0], innerDepthMm: dims[1], innerHeightMm: dims[2], material: form.material,
      supplierId: form.supplier || undefined, unitPriceKrw: Number(form.unitPriceKrw), isCustom: form.kind === 'custom',
      isActive: form.inUse, description: form.description }
    if (target) body.expectedVersion = target.version
    else { body.initialOnHandQty = Number(form.initialOnHandQty); body.safetyQty = Number(form.safetyQty); if (form.targetQty !== '') body.targetQty = Number(form.targetQty) }
    await warehouseApi(target ? `/box-specs/${target.id}` : '/box-specs', { method: target ? 'PATCH' : 'POST', body })
    formModal.value = null; toastMessage.value = '박스 규격이 저장되었습니다.'; await refresh(); loadSuppliers()
  } catch (cause) { toastMessage.value = cause.message }
  finally { saving.value = false }
}
async function requestDelete() {
  if (saving.value) return
  saving.value = true
  try { await warehouseApi(`/box-specs/${deletingSpec.value.id}`, { method: 'DELETE', query: { expectedVersion: deletingSpec.value.version } });
    deletingSpec.value = null; toastMessage.value = '규격이 삭제되었습니다.'; await refresh()
  } catch (cause) { toastMessage.value = cause.message }
  finally { saving.value = false }
}
</script>

<template>
  <div class="box-spec">
    <PageHeader
      title="박스 규격 관리"
      description="물류센터에서 사용하는 택배 상자 규격 정보를 등록하고 관리합니다."
    >
      <template #actions>
        <AppButton variant="primary" :disabled="!auth.canEdit.value" @click="openCreate">+ 규격 추가</AppButton>
      </template>
    </PageHeader>

    <ApiState :loading="loading" :error="error" @retry="refresh" />

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
          <AppButton size="sm" :disabled="!auth.canEdit.value" @click="openEdit(row)">수정</AppButton>
          <!-- 연결 상품이 있는 규격은 삭제할 수 없어 미사용 규격에만 삭제 버튼을 둡니다. -->
          <AppButton
            v-if="row.status === '미사용'"
            size="sm"
            variant="danger-outline"
            :disabled="!auth.canEdit.value" @click="deletingSpec = row"
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
        박스 규격을 수정하면 연결된 상품의 매칭 적합 여부와 비율이 다시 계산됩니다.
      </p>
    </div>

    <Pagination v-if="totalPages > 1" v-model="page" :total-pages="totalPages" />
    <BoxSpecFormModal
      v-if="formModal"
      :spec="formModal.spec" :suppliers="supplierOptions" :busy="saving"
      @close="formModal = null"
      @save="handleSave"
    />

    <BoxSpecDeleteModal
      v-if="deletingSpec"
      :spec="deletingSpec"
      @close="deletingSpec = null"
      @confirm="requestDelete"
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
