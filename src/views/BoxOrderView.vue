<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ApiState from '@/components/common/ApiState.vue'
import AppToast from '@/components/common/AppToast.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ProposalCard from './order/ProposalCard.vue'
import PurchaseOrderDraftCard from './order/PurchaseOrderDraftCard.vue'
import { auth, warehouseApi } from '@/stores/auth'
import { apiUrl } from '@/api/client'
import { monthPeriod, nextMonth } from '@/api/format'
import { costComparisons, draftModel, proposalModel } from '@/api/models'
import { useRemote } from '@/composables/useRemote'

const router = useRouter()

// 박스 주문은 다음 달 발주를 준비하는 화면입니다.
const targetMonth = nextMonth()
const orderPeriod = `발주 대상 기간  ${monthPeriod(targetMonth)}`

const { loading, error, load } = useRemote()
// 최신 제안서 조회 결과 { dataStatus, result, latestJob }
const latest = ref(null)
const comparisons = ref([])
// 화면에서 지켜보는 AI 에이전트 작업 { id, status, failureMessage, … }
const task = ref(null)
// 에이전트가 지금 하고 있는 단계(진행 이벤트의 node)와 끝난 단계 결과 문장 [{ id, text }], 진행 단계 n/전체
const step = ref('')
const progress = ref([])
const stepCount = ref({ done: 0, total: 0 })
// 승인 대기 중인 제안서 초안 { html, totalAmount, newSpecs }
const review = ref(null)
// 공급사가 여러 곳이면 발주서도 공급사별로 나뉩니다.
const drafts = ref([])
const activeId = ref('')
const busy = ref(false)
const toastMessage = ref('')

const proposal = computed(() => proposalModel(latest.value?.result))
// 지난 달 제안서 보기: 승인된 AI 제안서 목록(대상 월별 최신 1건)과 고른 월의 제안서. 다음 달(targetMonth)은 위 latest 를 씁니다.
const choices = ref([])
const viewMonth = ref(targetMonth)
const past = ref(null)
const monthOptions = computed(() => {
  const label = (m) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`
  const months = [...new Set(choices.value.map((c) => c.targetMonth))].filter((m) => m !== targetMonth)
  return [
    { value: targetMonth, label: `${label(targetMonth)} (다음 달)` },
    ...months.map((m) => ({ value: m, label: label(m) })),
  ]
})
const viewingPast = computed(() => viewMonth.value !== targetMonth)
const shownProposal = computed(() => (viewingPast.value ? past.value : proposal.value))

async function loadChoices() {
  const { data } = await warehouseApi('/procurement-proposals')
  choices.value = data
}

async function selectMonth(month) {
  viewMonth.value = month
  past.value = null
  if (month === targetMonth) return
  const choice = choices.value.find((c) => c.targetMonth === month)
  if (!choice) return
  try {
    const { data } = await warehouseApi(`/procurement-proposals/${choice.id}`)
    if (viewMonth.value === month) past.value = proposalModel(data)
  } catch (cause) {
    toastMessage.value = cause.message
  }
}
const activeDraft = computed(() => drafts.value.find((draft) => draft.id === activeId.value) ?? null)

const ACTIVE_TASK = ['RUNNING', 'WAITING_APPROVAL']
const jobRunning = computed(() => task.value?.status === 'RUNNING')
const reviewing = computed(() => task.value?.status === 'WAITING_APPROVAL')
const jobFailed = computed(() => task.value?.status === 'FAILED')

// 진행 이벤트의 node 이름 → 화면 문구
const STEPS = {
  load_context: '센터 정보와 규칙을 읽고 있어요',
  collect_data: '출고·재고 데이터를 모으고 있어요',
  forecast_demand: '다음 달 출고를 예측하고 있어요',
  analyze_fit: '상품과 박스 충진율을 분석하고 있어요',
  diagnose: '저충진·미적합 출고를 진단하고 있어요',
  find_clusters: '비슷한 크기의 상품을 묶고 있어요',
  gen_candidates: '신규 규격 후보를 찾고 있어요',
  simulate: '후보 규격으로 포장을 시뮬레이션하고 있어요',
  plan_order: '주문 수량을 계산하고 있어요',
  write_proposal: '제안서를 작성하고 있어요',
  evaluate: '제안서를 검토하고 있어요',
  interpret_feedback: '반려 의견을 반영하고 있어요',
  save_result: '승인된 제안서를 저장하고 있어요',
}

const jobNotice = computed(() => {
  if (jobRunning.value)
    return `AI 에이전트가 ${STEPS[step.value] ?? '제안서를 만들고 있어요'}. 승인할 초안이 준비되면 알려 드려요.`
  if (reviewing.value) return '제안서 초안이 준비됐어요. 내용을 확인하고 승인하거나 반려 의견을 남겨 주세요.'
  if (!jobFailed.value) return ''
  const reason = task.value.failureMessage ?? '원인을 확인할 수 없어요.'
  return `작업 실패 · ${reason}${proposal.value ? ' 마지막으로 저장된 제안서를 보여 드려요.' : ''}`
})

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
    },
  )
}

// 새로 고침해도 진행 중인 작업(실행 중·승인 대기)을 이어서 보여 줍니다.
async function resumeTask() {
  const { data } = await warehouseApi('/ai-tasks', { query: { mine: false } })
  const active = data.find((t) => t.targetMonth === targetMonth && ACTIVE_TASK.includes(t.status))
  if (active) watchTask(active)
}

// AI 작업은 접수(202)만 바로 끝납니다. 상태는 주기적으로 확인하고(서버가 에이전트와 맞춰 줌),
// 진행 단계·승인할 초안은 진행 이벤트(SSE)로 받습니다. 이벤트가 끊겨도 상태 확인은 계속됩니다.
let pollTimer = null
let events = null
let disposed = false

function closeEvents() {
  events?.close()
  events = null
}

function openEvents(id) {
  closeEvents()
  if (!globalThis.EventSource) return
  events = new EventSource(apiUrl(`/warehouses/${auth.warehouseId.value}/ai-tasks/${id}/stream`), {
    withCredentials: true,
  })
  const data = (event) => {
    try {
      return JSON.parse(event.data)
    } catch {
      return {}
    }
  }
  // 끊겼다 다시 붙으면 처음부터 다시 받으므로 이벤트 id 로 한 번만 담습니다.
  const seen = new Set()
  events.addEventListener('TOOL_START', (event) => {
    step.value = data(event).node ?? step.value
  })
  events.addEventListener('PROGRESS', (event) => {
    if (seen.has(event.lastEventId)) return
    seen.add(event.lastEventId)
    const d = data(event)
    progress.value = [...progress.value, { id: event.lastEventId, text: d.text }]
    if (d.step) stepCount.value = { done: d.step, total: d.total }
  })
  events.addEventListener('APPROVAL_REQUIRED', (event) => {
    const d = data(event)
    review.value = { html: d.proposalHtml ?? '', totalAmount: d.totalAmount, newSpecs: d.newSpecs ?? [] }
  })
  events.addEventListener('DONE', closeEvents)
  events.addEventListener('FAILED', closeEvents)
  // 끊기면 브라우저가 다시 붙으며 처음부터 다시 받습니다. 작업이 끝났으면 닫습니다.
  events.onerror = () => {
    if (!ACTIVE_TASK.includes(task.value?.status)) closeEvents()
  }
}

function watchTask(next) {
  const first = task.value?.id !== next.id
  task.value = next
  clearTimeout(pollTimer)
  if (first) {
    step.value = ''
    progress.value = []
    stepCount.value = { done: 0, total: 0 }
    review.value = null
    if (ACTIVE_TASK.includes(next.status)) openEvents(next.id)
  }
  if (!disposed && ACTIVE_TASK.includes(next.status)) pollTimer = setTimeout(pollTask, 2500)
}

async function pollTask() {
  try {
    const { data } = await warehouseApi(`/ai-tasks/${task.value.id}`)
    if (disposed) return
    if (data.status !== 'DONE') {
      watchTask(data)
      return
    }
    // 승인되어 저장됐으면 이전 제안서로 만든 발주서 초안은 화면에서 내립니다.
    task.value = data
    review.value = null
    closeEvents()
    drafts.value = []
    activeId.value = ''
    await refresh()
    loadChoices().catch(() => {})
    // 승인한 제안서는 바로 공급사별 발주서 초안으로 이어집니다(별도 버튼 없이).
    if (data.decision === 'APPROVED' && proposal.value?.totalQty) await applyProposal()
    else toastMessage.value = '작업이 끝났습니다.'
  } catch (cause) {
    // 확인을 멈추고 버튼을 다시 열어 둡니다. 다시 누르면 서버가 진행 중인 작업을 돌려줍니다.
    task.value = null
    closeEvents()
    toastMessage.value = cause.message
  }
}

async function runJob() {
  if (busy.value || jobRunning.value || reviewing.value) return
  busy.value = true
  try {
    const { data } = await warehouseApi('/ai-tasks', { method: 'POST', body: { targetMonth } })
    watchTask(data)
  } catch (cause) {
    toastMessage.value = cause.message
  } finally {
    busy.value = false
  }
}

// 승인하면 에이전트가 제안서를 저장하고, 반려하면 의견을 반영해 다시 작성한 초안으로 돌아옵니다.
async function decide({ decision, comment }) {
  if (busy.value || !reviewing.value) return
  busy.value = true
  try {
    const { data } = await warehouseApi(`/ai-tasks/${task.value.id}/approval`, {
      method: 'POST',
      body: { decision, comment: comment || undefined },
    })
    review.value = null
    watchTask(data)
    toastMessage.value =
      decision === 'APPROVED' ? '승인했습니다. 제안서를 저장하고 있어요.' : '반려 의견을 반영해 다시 작성하고 있어요.'
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
  // 승인 가능 여부(권한·수량·납품일)는 발주서 카드가 버튼을 막아 두고 판단합니다.
  const draft = activeDraft.value
  if (!draft || busy.value) return
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

onMounted(() => {
  refresh()
  resumeTask().catch(() => {})
  loadChoices().catch(() => {})
})

onBeforeUnmount(() => {
  disposed = true
  clearTimeout(pollTimer)
  closeEvents()
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
      <ProposalCard
        :proposal="shownProposal"
        :month-options="monthOptions"
        :view-month="viewMonth"
        :readonly="viewingPast"
        @update:view-month="selectMonth"
        :comparisons="comparisons"
        :loaded="Boolean(latest)"
        :target-month="targetMonth"
        :busy="busy"
        :job-running="jobRunning"
        :job-failed="jobFailed"
        :job-notice="jobNotice"
        :reviewing="reviewing"
        :review="review"
        :progress="progress"
        :step-count="stepCount"
        @run-job="runJob"
        @decide="decide"
        @apply="applyProposal"
      />

      <PurchaseOrderDraftCard
        v-model="activeId"
        :drafts="drafts"
        :busy="busy"
        @approve="approve"
        @go-history="goToHistory"
      />
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

@media (max-width: 1180px) {
  .box-order__columns {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
