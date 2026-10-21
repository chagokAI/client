<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ApiState from '@/components/common/ApiState.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import AppToast from '@/components/common/AppToast.vue'
import DataTable from '@/components/common/DataTable.vue'
import DateField from '@/components/common/DateField.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import QuantityStepper from '@/components/common/QuantityStepper.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { JOB, costComparisons, currency, draftModel, localDate, monthPeriod, nextMonth, proposalModel } from '@/api/adapters'
import { useRemote } from '@/composables/useRemote'
import { useAgentTask } from '@/composables/useAgentTask'

const router = useRouter()

// 박스 주문은 다음 달 발주를 준비하는 화면입니다.
const targetMonth = nextMonth()
const orderPeriod = `발주 대상 기간  ${monthPeriod(targetMonth)}`

// 납품 희망일은 오늘보다 이전으로 잡을 수 없습니다.
const today = localDate()

const { loading, error, load } = useRemote()
// 최신 제안서 조회 결과 { dataStatus, result, latestJob }
const latest = ref(null)
const comparisons = ref([])
// 화면에서 지켜보는 참고 계산 작업
const job = ref(null)
// 공급사가 여러 곳이면 발주서도 공급사별로 나뉩니다.
const drafts = ref([])
const activeId = ref('')
const busy = ref(false)
const toastMessage = ref('')

const proposal = computed(() => proposalModel(latest.value?.result))

// AI 개선 실행: 에이전트가 규격·출고·재고를 분석해 제안서를 만들고, 저장 전에 담당자 승인을 기다린다.
const agent = useAgentTask({
  onDone: async () => {
    drafts.value = []
    activeId.value = ''
    await refresh()
    toastMessage.value = 'AI 개선 제안서를 불러왔습니다.'
  },
})
const rejectComment = ref('')
const agentNotice = computed(() => {
  if (agent.phase.value === 'running') return `AI가 개선안을 만들고 있어요 · ${agent.step.value} (${agent.toolCount.value}단계)`
  if (agent.phase.value === 'failed') return `AI 개선 실행 실패 · ${agent.error.value}`
  return ''
})

async function decideAgent(decision) {
  await agent.decide(decision, decision === 'REJECTED' ? rejectComment.value.trim() : '')
  if (decision === 'REJECTED') rejectComment.value = ''
}
const activeDraft = computed(() => drafts.value.find((draft) => draft.id === activeId.value) ?? null)
const draftOptions = computed(() =>
  drafts.value.map((draft) => ({ value: draft.id, label: `${draft.supplierName} · ${draft.statusLabel}` })),
)
// 수량·납품일은 승인 대기 상태에서 운영자만 고칠 수 있습니다.
const editable = computed(() => auth.canEdit.value && activeDraft.value?.status === 'PENDING')

const proposalColumns = [
  { key: 'code', label: '규격', width: '16%' },
  { key: 'current', label: '현재 재고', width: '21%', align: 'right' },
  { key: 'expected', label: '대상 월 참고 소모', width: '25%', align: 'right' },
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

// 화면 합계는 미리보기입니다. 승인하면 서버가 저장 단가로 금액을 다시 계산합니다.
const totalQuantity = computed(() => activeDraft.value?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0)

const totalAmount = computed(
  () => activeDraft.value?.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0) ?? 0,
)

const canApprove = computed(
  () => editable.value && !busy.value && totalQuantity.value > 0 && Boolean(activeDraft.value?.deliveryDate),
)

const ACTIVE_JOB = ['PENDING', 'RUNNING']
const jobRunning = computed(() => ACTIVE_JOB.includes(job.value?.status))
const jobFailed = computed(() => Boolean(job.value) && !jobRunning.value && job.value.status !== 'SUCCEEDED')

const jobNotice = computed(() => {
  if (jobRunning.value) return '참고 계산을 진행하고 있어요. 끝나면 제안서를 자동으로 다시 불러와요.'
  if (!jobFailed.value) return ''
  const reason = job.value.failure?.message ?? '원인을 확인할 수 없어요.'
  return `${JOB[job.value.status] ?? job.value.status} · ${reason}${proposal.value ? ' 마지막으로 성공한 제안서를 보여 드려요.' : ''}`
})

function formatCurrency(value) {
  return currency(value)
}

function refresh() {
  return load(
    (signal) =>
      Promise.all([
        warehouseApi('/procurement-proposals/latest', { signal, query: { targetMonth } }),
        warehouseApi('/cost-forecasts/latest', { signal, query: { targetMonth } }),
      ]),
    ([proposalResponse, costResponse]) => {
      latest.value = proposalResponse.data
      comparisons.value = costComparisons(costResponse.data.result)
      watchJob(proposalResponse.data.latestJob)
    },
  )
}

// 계산 작업은 접수(202)만 바로 끝나므로, 완료될 때까지 상태를 주기적으로 확인합니다.
let pollTimer = null
let disposed = false

function watchJob(next) {
  job.value = next
  clearTimeout(pollTimer)
  if (!disposed && ACTIVE_JOB.includes(next?.status)) pollTimer = setTimeout(pollJob, 2000)
}

async function pollJob() {
  try {
    const { data } = await warehouseApi(`/jobs/${job.value.id}`)
    if (disposed) return
    if (data.status !== 'SUCCEEDED') {
      watchJob(data)
      return
    }
    // 새 제안서가 생기면 이전 제안서로 만든 발주서 초안은 화면에서 내립니다.
    job.value = data
    drafts.value = []
    activeId.value = ''
    await refresh()
    toastMessage.value = '새 제안서를 불러왔습니다.'
  } catch (cause) {
    // 확인을 멈추고 버튼을 다시 열어 둡니다. 다시 누르면 서버가 진행 중인 작업을 돌려줍니다.
    job.value = null
    toastMessage.value = cause.message
  }
}

async function runJob() {
  if (busy.value || jobRunning.value) return
  busy.value = true
  try {
    const { data } = await warehouseApi('/ai-jobs', {
      method: 'POST',
      body: { targetMonth, type: 'PROCUREMENT_AND_COST' },
    })
    watchJob(data)
  } catch (cause) {
    toastMessage.value = cause.message
  } finally {
    busy.value = false
  }
}

function setDrafts(orders) {
  drafts.value = orders.map(draftModel)
  // 아직 승인하지 않은 발주서를 먼저 보여 줍니다.
  activeId.value = (drafts.value.find((draft) => draft.status === 'PENDING') ?? drafts.value[0])?.id ?? ''
}

// 같은 제안서로 다시 요청하면 서버가 이미 만든 초안을 그대로 돌려줍니다.
// 그래서 다시 누르면 화면에서 고친 수량이 서버에 저장된 값으로 돌아갑니다.
async function loadDrafts() {
  const { data } = await warehouseApi('/purchase-orders/from-proposal', {
    method: 'POST',
    body: { proposalId: proposal.value.id },
  })
  setDrafts(data.orders)
  return data.orders
}

async function applyProposal() {
  if (!proposal.value || busy.value) return
  busy.value = true
  try {
    const orders = await loadDrafts()
    toastMessage.value =
      orders.length > 1
        ? `공급사별 발주서 ${orders.length}건에 제안 수량이 반영되었습니다.`
        : '제안 수량이 발주서에 반영되었습니다.'
  } catch (cause) {
    toastMessage.value = cause.message
  } finally {
    busy.value = false
  }
}

async function approve() {
  const draft = activeDraft.value
  if (!draft || !canApprove.value) return
  busy.value = true
  try {
    // 수량·납품일 변경과 승인을 한 번에 보내 서버에서 함께 반영합니다.
    const changedItems = draft.items
      .filter((item) => item.quantity !== item.savedQty)
      .map((item) => ({ boxSpecId: item.id, qty: item.quantity }))
    const { data } = await warehouseApi(`/purchase-orders/${draft.id}`, {
      method: 'PATCH',
      body: {
        expectedVersion: draft.version,
        status: 'APPROVED',
        requestedDeliveryDate: draft.deliveryDate !== draft.savedDeliveryDate ? draft.deliveryDate : undefined,
        items: changedItems.length ? changedItems : undefined,
      },
    })
    drafts.value = drafts.value.map((item) => (item.id === data.id ? draftModel(data) : item))

    const remaining = drafts.value.filter((item) => item.status === 'PENDING')
    if (!remaining.length) {
      router.push('/purchase-orders')
      return
    }
    activeId.value = remaining[0].id
    toastMessage.value = `${data.poNo} 발주서가 승인되었습니다. 남은 발주서 ${remaining.length}건도 확인해 주세요.`
  } catch (cause) {
    toastMessage.value = cause.message
    // 다른 사람이 먼저 고쳤다면 최신 초안을 다시 불러옵니다.
    if (cause.code === 'VERSION_CONFLICT') await loadDrafts().catch(() => {})
  } finally {
    busy.value = false
  }
}

function goToHistory() {
  router.push('/purchase-orders')
}

onMounted(refresh)

onBeforeUnmount(() => {
  disposed = true
  clearTimeout(pollTimer)
})
</script>

<template>
  <div class="box-order">
    <PageHeader
      title="박스 주문"
      description="박스 주문 제안서를 검토하고, 공급사별 발주서를 승인하세요."
      :meta="orderPeriod"
    />

    <ApiState :loading="loading" :error="error" @retry="refresh" />

    <div class="box-order__columns">
      <AppCard class="proposal">
        <template #header>
          <div class="card-title-row">
            <h2 class="card-title">박스 주문 제안서</h2>
            <span v-if="proposal" class="ai-tag">{{ proposal.baseline ? '참고 계산' : 'AI 생성' }}</span>
          </div>
        </template>

        <template #actions>
          <span v-if="proposal" class="card-meta">{{ proposal.createdAt }}</span>
          <AppButton size="sm" :disabled="!auth.canEdit.value || busy || jobRunning" @click="runJob">
            {{ jobRunning ? '계산 중…' : proposal ? '다시 계산' : '계산 실행' }}
          </AppButton>
          <AppButton
            size="sm"
            variant="primary"
            :disabled="!auth.canEdit.value || agent.running.value"
            @click="agent.start(targetMonth)"
          >
            {{ agent.running.value ? 'AI 실행 중…' : '개선 실행' }}
          </AppButton>
        </template>

        <p
          v-if="agentNotice"
          class="job-notice"
          :class="{ 'job-notice--error': agent.phase.value === 'failed' }"
          role="status"
        >
          {{ agentNotice }}
        </p>

        <section v-if="agent.approval.value" class="agent-approval" aria-label="AI 제안서 승인">
          <h3 class="agent-approval__title">AI 개선 제안서 승인 요청</h3>
          <p class="agent-approval__summary">
            총 {{ agent.approval.value.qty?.toLocaleString() }}개 · {{ formatCurrency(agent.approval.value.totalAmount) }}
            <template v-if="agent.approval.value.newSpecs?.length">
              · 신규 규격 {{ agent.approval.value.newSpecs.join(', ') }}
            </template>
            · 자체 검토 {{ agent.approval.value.score }}점
          </p>
          <details class="agent-approval__body">
            <summary>제안서 초안 보기</summary>
            <pre>{{ agent.approval.value.proposalMarkdown }}</pre>
          </details>
          <ul v-if="agent.approval.value.sources?.length" class="agent-approval__sources">
            <li v-for="item in agent.approval.value.sources" :key="item.sourceId">
              <strong>{{ item.sourceId }}</strong> {{ item.title }}
            </li>
          </ul>
          <textarea
            v-model="rejectComment"
            class="agent-approval__comment"
            rows="2"
            maxlength="500"
            placeholder="반려 의견 (예: 안전 재고 넉넉하게, 신규 규격은 빼고)"
          />
          <div class="agent-approval__actions">
            <AppButton size="sm" variant="danger-outline" :disabled="!rejectComment.trim()" @click="decideAgent('REJECTED')">
              반려하고 다시 작성
            </AppButton>
            <AppButton size="sm" variant="primary" @click="decideAgent('APPROVED')">승인하고 저장</AppButton>
          </div>
        </section>

        <p v-if="jobNotice" class="job-notice" :class="{ 'job-notice--error': jobFailed }" role="status">
          {{ jobNotice }}
        </p>

        <template v-if="proposal">
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

          <section v-if="proposal.rationale.length" class="rationale">
            <h3 class="rationale__title">제안 근거</h3>
            <ul class="rationale__list">
              <li v-for="reason in proposal.rationale" :key="reason">{{ reason }}</li>
            </ul>
          </section>

          <div class="proposal__total">
            <span class="proposal__total-label">예상 총 주문금액 (VAT 별도)</span>
            <strong class="proposal__total-value">{{ proposal.totalAmount }}</strong>
          </div>

          <ul v-if="comparisons.length" class="comparison">
            <li v-for="item in comparisons" :key="item.id" class="comparison__item">
              <p class="comparison__label">{{ item.label }}</p>
              <p class="comparison__change">{{ item.change }}</p>
            </li>
          </ul>

          <AppButton
            class="proposal__apply"
            variant="secondary"
            block
            :disabled="!auth.canEdit.value || busy || !proposal.totalQty"
            @click="applyProposal"
          >
            발주서에 반영하기 <span aria-hidden="true">→</span>
          </AppButton>
          <p v-if="!auth.canEdit.value" class="card-hint">발주서는 운영자 이상 권한으로 만들 수 있어요.</p>
        </template>

        <div v-else-if="latest" class="empty-state">
          <p class="empty-state__title">{{ Number(targetMonth.slice(5)) }}월 제안서가 아직 없어요.</p>
          <p class="empty-state__text">
            [계산 실행]을 누르면 최근 관측 이력으로 참고 제안서를 만들어요.
            활성 규격과 현재 재고·안전 재고·단가가 등록되어 있어야 계산할 수 있어요.
          </p>
        </div>
      </AppCard>

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
            v-model="activeId"
            class="purchase-order__suppliers"
            :options="draftOptions"
            aria-label="공급사별 발주서"
          />

          <dl class="order-info">
            <div v-for="field in activeDraft.info" :key="field.id" class="order-info__field">
              <dt :id="`order-info-${field.id}`">{{ field.label }}</dt>
              <dd v-if="field.id === 'due-date' && editable" class="order-info__value--editable">
                <DateField
                  v-model="activeDraft.deliveryDate"
                  :min="today"
                  show-weekday
                  :aria-label="field.label"
                />
              </dd>
              <dd v-else>{{ field.value }}</dd>
            </div>
          </dl>

          <DataTable class="purchase-order__table" :columns="orderColumns" :rows="activeDraft.items" row-key="id">
            <template #cell-code="{ row }">
              <strong>{{ row.code }}</strong>
            </template>

            <template #cell-quantity="{ row }">
              <QuantityStepper v-if="editable" v-model="row.quantity" :min="0" :ariaLabel="`${row.code} 수량`" />
              <span v-else>{{ row.quantity.toLocaleString('ko-KR') }}개</span>
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

          <p class="purchase-order__note">
            <template v-if="editable">
              제안서 수량이 자동으로 입력되었습니다. −/+ 버튼으로 100개 단위로 수정하면 총 수량과 합계가 바로 바뀝니다.
              수량을 0으로 두면 해당 규격은 발주에서 빠집니다.
            </template>
            <template v-else-if="activeDraft.status !== 'PENDING'">이미 처리된 발주서예요. 진행 상태는 발주서 이력에서 확인할 수 있어요.</template>
            <template v-else>발주서 수정과 승인은 운영자 이상 권한으로 할 수 있어요.</template>
          </p>
        </template>

        <div v-else class="empty-state">
          <p class="empty-state__title">아직 불러온 발주서가 없어요.</p>
          <p class="empty-state__text">제안서의 [발주서에 반영하기]를 누르면 공급사별 발주서 초안이 만들어져요.</p>
        </div>

        <div class="purchase-order__actions">
          <AppButton size="lg" @click="goToHistory">이력 보러 가기</AppButton>
          <AppButton size="lg" variant="primary" :disabled="!canApprove" @click="approve">승인하기</AppButton>
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

.card-hint {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

/* 계산 작업 상태 */
.job-notice {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: var(--radius-md);
  background: var(--color-info-bg);
  color: var(--color-info-text);
  font-size: 12px;
  line-height: 1.5;
  word-break: keep-all;
}

.job-notice--error {
  background: var(--color-danger-bg);
  color: var(--color-danger-text);
}

/* AI 개선 제안서 승인 */
.agent-approval {
  display: grid;
  gap: 10px;
  margin: 0 0 16px;
  padding: 14px 16px;
  border: 1px solid var(--color-gold);
  border-radius: var(--radius-md);
  font-size: 12px;
  line-height: 1.5;
}

.agent-approval__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}

.agent-approval__summary {
  margin: 0;
  color: var(--color-text-secondary);
  word-break: keep-all;
}

.agent-approval__body pre {
  max-height: 280px;
  overflow: auto;
  margin: 8px 0 0;
  font-family: inherit;
  white-space: pre-wrap;
}

.agent-approval__sources {
  margin: 0;
  padding-left: 16px;
  color: var(--color-text-secondary);
}

.agent-approval__comment {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font: inherit;
  resize: vertical;
}

.agent-approval__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* 제안서·발주서가 아직 없을 때 */
.empty-state {
  padding: 32px 16px;
  border: 1px dashed var(--color-card-border);
  border-radius: var(--radius-md);
  text-align: center;
}

.empty-state__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.5;
}

.empty-state__text {
  margin: 6px 0 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: keep-all;
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
