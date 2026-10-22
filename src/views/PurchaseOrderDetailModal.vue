<script setup>
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import DataTable from '@/components/common/DataTable.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import StepProgress from '@/components/common/StepProgress.vue'
const purchaseOrderSteps = ['제안서 생성', '발주서 작성', '승인 완료', '배송 중', '입고 완료']

defineProps({
  detail: {
    type: Object,
    required: true,
  },
})

// 승인은 박스 주문 화면에서만 합니다. 이 모달은 조회 전용입니다.
const emit = defineEmits(['close'])

const columns = [
  { key: 'code', label: '규격', width: '13%' },
  { key: 'size', label: '사이즈 (mm)', width: '27%' },
  { key: 'quantity', label: '수량', width: '20%', align: 'right' },
  { key: 'unitPrice', label: '단가', width: '18%', align: 'right' },
  { key: 'amount', label: '금액', width: '22%', align: 'right' },
]

function downloadPdf() {
  // TODO: 발주서 PDF 다운로드 API에 연결합니다.
}
</script>

<template>
  <BaseModal title="발주서 상세" :description="detail.caption" width="760px" @close="emit('close')">
    <template #title-badge>
      <StatusBadge :label="detail.statusLabel" />
    </template>

    <StepProgress v-if="detail.status !== 'REJECTED'" :steps="purchaseOrderSteps" :current-index="detail.currentStepIndex" />

    <dl class="detail-info">
      <div v-for="field in detail.info" :key="field.id" class="detail-info__field">
        <dt>{{ field.label }}</dt>
        <dd>{{ field.value }}</dd>
      </div>
    </dl>

    <DataTable class="detail-table" :columns="columns" :rows="detail.items" row-key="id">
      <template #cell-code="{ row }">
        <strong>{{ row.code }}</strong>
      </template>
    </DataTable>

    <div class="detail-total">
      <span>{{ detail.totalQuantity }}</span>
      <span class="detail-total__amount">
        합계 (VAT 별도) <strong>{{ detail.totalAmount }}</strong>
      </span>
    </div>

    <template #footer>
      <button class="detail-download" type="button" disabled title="PDF 다운로드는 준비 중이에요">
        <span aria-hidden="true">↓</span> PDF 다운로드
      </button>
      <AppButton @click="emit('close')">닫기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.detail-info {
  display: grid;
  gap: 14px 24px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 20px 0 0;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
}

.detail-info__field {
  min-width: 0;
}

.detail-info dt {
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.detail-info dd {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  word-break: keep-all;
}

.detail-table {
  margin-top: 16px;
}

.detail-table :deep(.data-table__table) {
  min-width: 560px;
}

.detail-total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
  font-size: 13px;
  font-weight: 600;
}

.detail-total__amount {
  color: var(--color-text-secondary);
  font-weight: 400;
}

.detail-total__amount strong {
  margin-left: 8px;
  color: var(--color-text);
  font-size: 19px;
  letter-spacing: -0.5px;
}

/* PDF 다운로드는 보조 동작이라 푸터 왼쪽 끝에 텍스트 버튼으로 둡니다. */
.detail-download {
  margin-right: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.detail-download:hover {
  color: var(--color-brown);
  text-decoration: underline;
}

@media (max-width: 760px) {
  .detail-info {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
