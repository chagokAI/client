<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import DateField from '@/components/common/DateField.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import QuantityStepper from '@/components/common/QuantityStepper.vue'
import { orderPeriod, proposal, purchaseOrderDraft } from '@/mocks/orders'

const router = useRouter()

// 수량은 사용자가 조정할 수 있어 복사본으로 들고 있습니다.
const items = ref(purchaseOrderDraft.items.map((item) => ({ ...item })))
const toastMessage = ref('')
const dueDate = ref(purchaseOrderDraft.dueDate)

// 납품 희망일은 오늘보다 이전으로 잡을 수 없습니다.
const today = new Date().toISOString().slice(0, 10)

const proposalColumns = [
  { key: 'code', label: '규격', width: '16%' },
  { key: 'current', label: '현재 재고', width: '21%', align: 'right' },
  { key: 'expected', label: '다음 달 예상 소모', width: '25%', align: 'right' },
  { key: 'safety', label: '안전 재고', width: '19%', align: 'right' },
  { key: 'suggested', label: '제안 수량', width: '19%', align: 'right' },
]

const orderColumns = [
  { key: 'code', label: '규격', width: '12%' },
  { key: 'size', label: '사이즈 (mm)', width: '26%' },
  { key: 'quantity', label: '수량', width: '24%' },
  { key: 'unitPrice', label: '단가', width: '17%', align: 'right' },
  { key: 'amount', label: '금액', width: '21%', align: 'right' },
]

const totalQuantity = computed(() => items.value.reduce((sum, item) => sum + item.quantity, 0))

const totalAmount = computed(() =>
  items.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
)

function formatCurrency(value) {
  return `₩${value.toLocaleString('ko-KR')}`
}

function applyProposal() {
  items.value = purchaseOrderDraft.items.map((item) => ({ ...item }))
  toastMessage.value = 'AI 제안 수량이 발주서에 반영되었습니다.'
}

function approve() {
  // TODO: 발주서 승인 API에 연결합니다. 수정한 수량과 납품 희망일을 함께 보냅니다.
  router.push({
    path: '/purchase-orders',
    query: {
      approved: purchaseOrderDraft.number,
      deliveryAt: dueDate.value,
    },
  })
}

function goToHistory() {
  router.push('/purchase-orders')
}
</script>

<template>
  <div class="box-order">
    <PageHeader
      title="박스 주문"
      description="AI가 작성한 박스 주문 제안서를 검토하고, 발주서를 승인하세요."
      :meta="orderPeriod"
    />

    <div class="box-order__columns">
      <AppCard class="proposal">
        <template #header>
          <div class="card-title-row">
            <h2 class="card-title">박스 주문 제안서</h2>
            <span class="ai-tag">AI 생성</span>
          </div>
        </template>

        <template #actions>
          <span class="card-meta">{{ proposal.createdAt }}</span>
        </template>

        <div class="proposal__headline">
          <p class="proposal__headline-text">{{ proposal.headline }}</p>
          <p class="proposal__headline-sub">{{ proposal.subline }}</p>
        </div>

        <DataTable class="proposal__table" :columns="proposalColumns" :rows="proposal.rows" row-key="id">
          <template #cell-code="{ row }">
            <strong>{{ row.code }}</strong>
          </template>
          <template #cell-suggested="{ row }">
            <strong>{{ row.suggested }}</strong>
          </template>
        </DataTable>

        <section class="rationale">
          <h3 class="rationale__title">제안 근거</h3>
          <ul class="rationale__list">
            <li v-for="reason in proposal.rationale" :key="reason">{{ reason }}</li>
          </ul>
        </section>

        <div class="proposal__total">
          <span class="proposal__total-label">예상 총 주문금액 (VAT 별도)</span>
          <strong class="proposal__total-value">{{ proposal.totalAmount }}</strong>
        </div>

        <ul class="comparison">
          <li v-for="item in proposal.comparisons" :key="item.id" class="comparison__item">
            <p class="comparison__label">{{ item.label }}</p>
            <p class="comparison__change">{{ item.change }}</p>
          </li>
        </ul>

        <AppButton class="proposal__apply" variant="secondary" block @click="applyProposal">
          발주서에 반영하기 <span aria-hidden="true">→</span>
        </AppButton>
      </AppCard>

      <AppCard class="purchase-order">
        <template #header>
          <div class="card-title-row">
            <h2 class="card-title">박스 주문 발주서</h2>
          </div>
        </template>

        <dl class="order-info">
          <div v-for="field in purchaseOrderDraft.info" :key="field.id" class="order-info__field">
            <dt :id="`order-info-${field.id}`">{{ field.label }}</dt>
            <dd v-if="field.editable === 'date'" class="order-info__value--editable">
              <DateField
                v-model="dueDate"
                :min="today"
                show-weekday
                :aria-label="field.label"
              />
            </dd>
            <dd v-else>{{ field.value }}</dd>
          </div>
        </dl>

        <DataTable class="purchase-order__table" :columns="orderColumns" :rows="items" row-key="id">
          <template #cell-code="{ row }">
            <strong>{{ row.code }}</strong>
          </template>

          <template #cell-quantity="{ row }">
            <QuantityStepper v-model="row.quantity" :min="0" :ariaLabel="`${row.code} 수량`" />
          </template>

          <template #cell-unitPrice="{ row }">
            {{ formatCurrency(row.unitPrice) }}
          </template>

          <template #cell-amount="{ row }">
            {{ formatCurrency(row.quantity * row.unitPrice) }}
          </template>
        </DataTable>

        <div class="purchase-order__total">
          <span class="purchase-order__total-quantity">
            총 수량 <strong>{{ totalQuantity.toLocaleString('ko-KR') }}개</strong>
          </span>
          <span class="purchase-order__total-amount">
            합계 (VAT 별도) <strong>{{ formatCurrency(totalAmount) }}</strong>
          </span>
        </div>

        <p class="purchase-order__note">{{ purchaseOrderDraft.note }}</p>

        <div class="purchase-order__actions">
          <AppButton size="lg" @click="goToHistory">이력 보러 가기</AppButton>
          <AppButton size="lg" variant="primary" @click="approve">승인하기</AppButton>
        </div>
      </AppCard>
    </div>

    <AppToast v-if="toastMessage" :message="toastMessage" @close="toastMessage = ''" />
  </div>
</template>

<style scoped>
.box-order__columns {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.card-meta {
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.ai-tag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--color-navy);
  color: var(--color-white);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

/* 제안서 */
.proposal__headline {
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
}

.proposal__headline-text {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  word-break: keep-all;
}

.proposal__headline-sub {
  margin: 5px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.proposal__table {
  margin-top: 16px;
}

.proposal__table :deep(.data-table__table) {
  min-width: 480px;
}

.rationale {
  margin-top: 20px;
}

.rationale__title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.rationale__list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.55;
}

.rationale__list li {
  position: relative;
  padding-left: 14px;
  word-break: keep-all;
}

.rationale__list li::before {
  content: '';
  position: absolute;
  top: 7px;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-gold);
}

.proposal__total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding: 16px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
}

.proposal__total-label {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.proposal__total-value {
  font-size: 20px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.comparison {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.comparison__item {
  padding: 12px 14px;
  border-radius: var(--radius-md);
  background: var(--color-cream);
}

.comparison__label {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.45;
  word-break: keep-all;
}

.comparison__change {
  margin: 5px 0 0;
  color: var(--color-danger-text);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
}

.proposal__apply {
  margin-top: 20px;
}

/* 발주서 */
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

.purchase-order__table :deep(.data-table__table) {
  min-width: 520px;
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

@media (max-width: 1180px) {
  .box-order__columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
