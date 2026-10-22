<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import ApiState from '@/components/common/ApiState.vue'
import AppToast from '@/components/common/AppToast.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import ProposalCard from './order/ProposalCard.vue'
import PurchaseOrderDraftCard from './order/PurchaseOrderDraftCard.vue'
import { warehouseApi } from '@/stores/auth'
import { JOB, monthPeriod, nextMonth } from '@/api/format'
import { costComparisons, draftModel, proposalModel } from '@/api/models'
import { useRemote } from '@/composables/useRemote'
import { useAgentTask } from '@/composables/useAgentTask'

const router = useRouter()

// 박스 주문은 다음 달 발주를 준비하는 화면입니다.
const targetMonth = nextMonth()
const orderPeriod = `발주 대상 기간  ${monthPeriod(targetMonth)}`

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
const activeDraft = computed(() => drafts.value.find((draft) => draft.id === activeId.value) ?? null)

// AI 개선 실행: 에이전트가 규격·출고·재고를 분석해 제안서를 만들고, 저장 전에 담당자 승인을 기다린다.
const agent = useAgentTask({
  onDone: async () => {
    drafts.value = []
    activeId.value = ''
    await refresh()
    toastMessage.value = 'AI 개선 제안서를 불러왔습니다.'
  },
})
const agentNotice = computed(() => {
  if (agent.phase.value === 'running') return `AI가 개선안을 만들고 있어요 · ${agent.step.value} (${agent.toolCount.value}단계)`
  if (agent.phase.value === 'failed') return `AI 개선 실행 실패 · ${agent.error.value}`
  return ''
})

const ACTIVE_JOB = ['PENDING', 'RUNNING']
const jobRunning = computed(() => ACTIVE_JOB.includes(job.value?.status))
const jobFailed = computed(() => Boolean(job.value) && !jobRunning.value && job.value.status !== 'SUCCEEDED')

const jobNotice = computed(() => {
  if (jobRunning.value) return '참고 계산을 진행하고 있어요. 끝나면 제안서를 자동으로 다시 불러와요.'
  if (!jobFailed.value) return ''
  const reason = job.value.failure?.message ?? '원인을 확인할 수 없어요.'
  return `${JOB[job.value.status] ?? job.value.status} · ${reason}${proposal.value ? ' 마지막으로 성공한 제안서를 보여 드려요.' : ''}`
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
      <ProposalCard
        :proposal="proposal"
        :comparisons="comparisons"
        :loaded="Boolean(latest)"
        :target-month="targetMonth"
        :busy="busy"
        :job-running="jobRunning"
        :job-failed="jobFailed"
        :job-notice="jobNotice"
        :agent-running="agent.running.value"
        :agent-failed="agent.phase.value === 'failed'"
        :agent-notice="agentNotice"
        :agent-approval="agent.approval.value"
        @run-job="runJob"
        @run-agent="agent.start(targetMonth)"
        @apply="applyProposal"
        @agent-decide="agent.decide"
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
