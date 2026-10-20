<script setup>
import { computed, reactive } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FormField from '@/components/common/FormField.vue'
import SelectField from '@/components/common/SelectField.vue'
import TextInput from '@/components/common/TextInput.vue'
import { boxInventory } from '@/mocks/boxes'
import { openPurchaseOrderOptions } from '@/mocks/orders'

const props = defineProps({
  spec: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'submit'])

const specOptions = boxInventory.map((item) => ({
  value: item.id,
  label: `${item.code} · ${item.sizeName}`,
}))

// 숫자 계산을 위해 '820개' 같은 표기에서 숫자만 뽑아 둡니다.
function toNumber(text) {
  return Number(String(text).replace(/[^\d]/g, ''))
}

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '.')
const linkedOrder = openPurchaseOrderOptions.find((order) => order.specIds.includes(props.spec.id))

const form = reactive({
  specId: props.spec.id,
  orderNumber: linkedOrder?.value ?? '',
  quantity: linkedOrder?.quantityBySpec[props.spec.id] ?? 0,
  receivedAt: today,
  memo: '',
})

const selectedSpec = computed(() => boxInventory.find((item) => item.id === form.specId) ?? props.spec)

const currentStock = computed(() => toNumber(selectedSpec.value.current))

const safetyStock = computed(() => toNumber(selectedSpec.value.safety))

const nextStock = computed(() => currentStock.value + Number(form.quantity || 0))

// 선택한 발주서에 이 규격이 몇 개 들어 있는지 보여 주는 안내입니다.
const orderedQuantityHint = computed(() => {
  const order = openPurchaseOrderOptions.find((item) => item.value === form.orderNumber)
  const ordered = order?.quantityBySpec[form.specId]
  return ordered ? `발주 수량 ${ordered.toLocaleString('ko-KR')}개` : ''
})

function format(value) {
  return `${value.toLocaleString('ko-KR')}개`
}

function handleSubmit() {
  // TODO: 입고 등록 API에 연결합니다.
  emit('submit', { ...form, specCode: selectedSpec.value.code, nextStock: nextStock.value })
}
</script>

<template>
  <BaseModal title="입고 등록" description="받은 박스 수량을 재고에 반영합니다" width="620px" @close="emit('close')">
    <form class="stock-in" novalidate @submit.prevent="handleSubmit">
      <div class="stock-in__row">
        <FormField v-slot="{ fieldId }" label="박스 규격" required>
          <SelectField :id="fieldId" v-model="form.specId" :options="specOptions" width="100%" aria-label="박스 규격" />
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
          <TextInput :id="fieldId" v-model="form.receivedAt" placeholder="2026.10.20" aria-label="입고일" />
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
      <AppButton variant="primary" @click="handleSubmit">입고 등록</AppButton>
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
  transition: border-color 160ms ease, box-shadow 160ms ease;
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
