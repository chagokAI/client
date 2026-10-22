<script setup>
import { computed } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import DataTable from '@/components/common/DataTable.vue'
import DateField from '@/components/common/DateField.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import QuantityStepper from '@/components/common/QuantityStepper.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { auth } from '@/stores/auth'
import { currency, localDate } from '@/api/format'

// 공급사별 발주서 초안 카드. 수량·납품일을 고치고 승인까지 맡습니다.
const props = defineProps({
  // draftModel() 결과 목록. 공급사가 여러 곳이면 여러 건입니다.
  drafts: { type: Array, default: () => [] },
  // 지금 보고 있는 발주서 id (v-model)
  modelValue: { type: String, default: '' },
  busy: Boolean,
})

const emit = defineEmits(['update:modelValue', 'approve', 'go-history'])

// 납품 희망일은 오늘보다 이전으로 잡을 수 없습니다.
const today = localDate()

const activeDraft = computed(() => props.drafts.find((draft) => draft.id === props.modelValue) ?? null)
const draftOptions = computed(() =>
  props.drafts.map((draft) => ({ value: draft.id, label: `${draft.supplierName} · ${draft.statusLabel}` })),
)

// 수량·납품일은 승인 대기 상태에서 운영자만 고칠 수 있습니다.
const editable = computed(() => auth.canEdit.value && activeDraft.value?.status === 'PENDING')

// 화면 합계는 미리보기입니다. 승인하면 서버가 저장 단가로 금액을 다시 계산합니다.
const totalQuantity = computed(() => activeDraft.value?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)
const totalAmount = computed(
  () => activeDraft.value?.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) ?? 0,
)
const canApprove = computed(
  () => editable.value && !props.busy && totalQuantity.value > 0 && Boolean(activeDraft.value?.deliveryDate),
)

const orderColumns = [
  { key: 'code', label: '규격', width: '12%' },
  { key: 'size', label: '사이즈 (mm)', width: '26%' },
  { key: 'quantity', label: '수량', width: '24%' },
  { key: 'unitPrice', label: '단가', width: '17%', align: 'right' },
  { key: 'amount', label: '금액', width: '21%', align: 'right' },
]
</script>

<template>
  <AppCard class="purchase-order">
    <template #header>
      <div class="card-title-row">
        <h2 class="card-title">박스 주문 발주서</h2>
        <StatusBadge v-if="activeDraft" :label="activeDraft.statusLabel" />
      </div>
    </template>

    <template v-if="activeDraft">
      <FilterChips
        v-if="drafts.length > 1"
        class="purchase-order__suppliers"
        :model-value="modelValue"
        :options="draftOptions"
        aria-label="공급사별 발주서"
        @update:model-value="emit('update:modelValue', $event)"
      />

      <dl class="order-info">
        <div v-for="field in activeDraft.info" :key="field.id" class="order-info__field">
          <dt :id="`order-info-${field.id}`">{{ field.label }}</dt>
          <dd v-if="field.id === 'due-date' && editable" class="order-info__value--editable">
            <DateField v-model="activeDraft.deliveryDate" :min="today" show-weekday :aria-label="field.label" />
          </dd>
          <dd v-else>{{ field.value }}</dd>
        </div>
      </dl>

      <DataTable
        class="purchase-order__table"
        :columns="orderColumns"
        :rows="activeDraft.items"
        row-key="id"
        min-width="520px"
      >
        <template #cell-code="{ row }">
          <strong>{{ row.code }}</strong>
        </template>

        <template #cell-quantity="{ row }">
          <QuantityStepper v-if="editable" v-model="row.quantity" :min="0" :aria-label="`${row.code} 수량`" />
          <span v-else>{{ row.quantity.toLocaleString('ko-KR') }}개</span>
        </template>

        <template #cell-unitPrice="{ row }">
          {{ currency(row.unitPrice) }}
        </template>

        <template #cell-amount="{ row }">
          {{ currency(row.quantity * row.unitPrice) }}
        </template>
      </DataTable>

      <div class="purchase-order__total">
        <span class="purchase-order__total-quantity">
          총 수량 <strong>{{ totalQuantity.toLocaleString('ko-KR') }}개</strong>
        </span>
        <span class="purchase-order__total-amount">
          합계 (VAT 별도) <strong>{{ currency(totalAmount) }}</strong>
        </span>
      </div>

      <p class="purchase-order__note">
        <template v-if="editable">
          제안서 수량이 자동으로 입력되었습니다. −/+ 버튼으로 100개 단위로 수정하면 총 수량과 합계가 바로 바뀝니다.
          수량을 0으로 두면 해당 규격은 발주에서 빠집니다.
        </template>
        <template v-else-if="activeDraft.status !== 'PENDING'"
          >이미 처리된 발주서예요. 진행 상태는 발주서 이력에서 확인할 수 있어요.</template
        >
        <template v-else>발주서 수정과 승인은 운영자 이상 권한으로 할 수 있어요.</template>
      </p>
    </template>

    <div v-else class="empty-state">
      <p class="empty-state__title">아직 불러온 발주서가 없어요.</p>
      <p class="empty-state__text">제안서의 [발주서 생성하기]를 누르면 공급사별 발주서 초안이 만들어져요.</p>
    </div>

    <div class="purchase-order__actions">
      <AppButton size="lg" @click="emit('go-history')">이력 보러 가기</AppButton>
      <AppButton size="lg" variant="primary" :disabled="!canApprove" @click="emit('approve')">승인하기</AppButton>
    </div>
  </AppCard>
</template>

<style scoped>
.purchase-order__suppliers {
  margin-bottom: 16px;
}

.order-info {
  display: grid;
  gap: 14px 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 16px 18px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
}

.order-info__field {
  min-width: 0;
}

.order-info dt {
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.order-info dd {
  margin: 4px 0 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
  word-break: keep-all;
}

/* 날짜 입력은 높이가 있어 읽기 전용 항목과 윗줄을 맞춥니다. */
.order-info__value--editable {
  margin-top: 2px;
}

.purchase-order__table {
  margin-top: 16px;
}

.purchase-order__total {
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
}

.purchase-order__total-quantity strong {
  margin-left: 6px;
  font-size: 14px;
}

.purchase-order__total-amount {
  color: var(--color-text-secondary);
}

.purchase-order__total-amount strong {
  margin-left: 8px;
  color: var(--color-text);
  font-size: 20px;
  letter-spacing: -0.5px;
}

.purchase-order__note {
  margin: 14px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.6;
  word-break: keep-all;
}

.purchase-order__actions {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20px;
}
</style>
