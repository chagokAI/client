<script setup>
import { computed, reactive, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FormField from '@/components/common/FormField.vue'
import SelectField from '@/components/common/SelectField.vue'
import TextInput from '@/components/common/TextInput.vue'
import DateField from '@/components/common/DateField.vue'
import ApiState from '@/components/common/ApiState.vue'
import { warehouseApi } from '@/stores/auth'
import { localDate, quantity } from '@/api/format'
import { useRemote } from '@/composables/useRemote'
// 규격은 표에서 입고를 누른 행으로 고정합니다. 다른 규격은 그 행의 입고 버튼으로 엽니다.
const props = defineProps({
  spec: { type: Object, required: true },
  busy: Boolean,
})
const emit = defineEmits(['close', 'submit'])
const orders = ref([])
const form = reactive({ specId: props.spec.id, orderNumber: '', quantity: 0, receivedAt: localDate(), memo: '' })
const requestId = crypto.randomUUID()
const { loading, error, load } = useRemote()
function refreshOrders() {
  return load(
    (signal) => warehouseApi('/purchase-orders/open', { signal, query: { boxSpecId: form.specId } }),
    ({ data }) => {
      orders.value = data
    },
  )
}
refreshOrders()
const openPurchaseOrderOptions = computed(() => [
  { value: '', label: '발주서 연결 안 함' },
  ...orders.value.map((order) => ({ value: order.id, label: order.poNo })),
])
const currentStock = computed(() => props.spec.onHandQty)
const safetyStock = computed(() => props.spec.safetyQty)
const nextStock = computed(() => (currentStock.value == null ? null : currentStock.value + Number(form.quantity || 0)))
const orderedQuantityHint = computed(() => {
  const order = orders.value.find((item) => item.id === form.orderNumber)
  const line = order?.items.find((item) => item.boxSpec.id === form.specId)
  return line ? `미입고 수량 ${quantity(line.remainingQty)}` : ''
})
function format(value) {
  return quantity(value)
}
function handleSubmit() {
  if (props.busy || loading.value) return
  emit('submit', { ...form, requestId })
}
</script>

<template>
  <BaseModal title="입고 등록" description="받은 박스 수량을 재고에 반영합니다" width="620px" @close="emit('close')">
    <ApiState :loading="loading" :error="error" @retry="refreshOrders" />
    <form class="stock-in" novalidate @submit.prevent="handleSubmit">
      <div class="stock-in__row">
        <FormField label="박스 규격">
          <p class="stock-in__spec">
            <strong>{{ spec.code }}</strong>
            <span class="stock-in__spec-name">{{ spec.sizeName }}</span>
          </p>
        </FormField>

        <FormField v-slot="{ fieldId }" label="연결 발주서">
          <SelectField
            :id="fieldId"
            v-model="form.orderNumber"
            :options="openPurchaseOrderOptions"
            width="100%"
            aria-label="연결 발주서"
          />
        </FormField>
      </div>

      <div class="stock-in__row">
        <FormField v-slot="{ fieldId }" label="입고 수량" required :hint="orderedQuantityHint">
          <TextInput :id="fieldId" v-model="form.quantity" suffix="개" format-number aria-label="입고 수량" />
        </FormField>

        <FormField v-slot="{ fieldId }" label="입고일" required>
          <DateField :id="fieldId" v-model="form.receivedAt" :max="localDate()" aria-label="입고일" />
        </FormField>
      </div>

      <div class="stock-in__preview">
        <div class="stock-in__preview-item">
          <p class="stock-in__preview-label">현재 재고</p>
          <p class="stock-in__preview-value">{{ format(currentStock) }}</p>
        </div>

        <span class="stock-in__arrow" aria-hidden="true">→</span>

        <div class="stock-in__preview-item">
          <p class="stock-in__preview-label">입고 후 재고</p>
          <p class="stock-in__preview-value stock-in__preview-value--next">{{ format(nextStock) }}</p>
        </div>

        <div class="stock-in__preview-item">
          <p class="stock-in__preview-label">안전 재고</p>
          <p class="stock-in__preview-value">{{ format(safetyStock) }}</p>
        </div>
      </div>

      <FormField v-slot="{ fieldId }" label="이상사항">
        <textarea
          :id="fieldId"
          v-model="form.memo"
          class="stock-in__memo"
          rows="3"
          placeholder="파손·수량 차이 등 특이사항을 적어주세요"
        />
      </FormField>
    </form>

    <template #footer>
      <AppButton @click="emit('close')">취소</AppButton>
      <AppButton variant="primary" :disabled="busy || loading || !!error" @click="handleSubmit">입고 등록</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.stock-in {
  display: grid;
  gap: 16px;
}

.stock-in__row {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* 규격은 고를 수 없으므로 입력칸 대신 글로 보여 줍니다. 높이는 옆 입력칸과 맞춥니다. */
.stock-in__spec {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  margin: 0;
  font-size: 13px;
}

.stock-in__spec-name {
  color: var(--color-text-secondary);
  font-size: 12px;
}

/* 현재 → 입고 후 → 안전 재고를 한 줄로 비교해 보여 줍니다. */
.stock-in__preview {
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: 1fr auto 1fr 1fr;
  padding: 18px 20px;
  border-radius: var(--radius-md);
  background: #f7f8f9;
  text-align: center;
}

.stock-in__preview-label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.stock-in__preview-value {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.6px;
}

.stock-in__preview-value--next {
  color: var(--color-info);
}

.stock-in__arrow {
  color: var(--color-text-muted);
  font-size: 18px;
}

.stock-in__memo {
  width: 100%;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.5;
  resize: vertical;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.stock-in__memo::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.stock-in__memo:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

@media (prefers-reduced-motion: reduce) {
  .stock-in__memo {
    transition: none;
  }
}
</style>
