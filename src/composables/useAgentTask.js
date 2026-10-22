import { computed, onBeforeUnmount, ref } from 'vue'
import { apiUrl } from '@/api/client'
import { auth, warehouseApi } from '@/stores/auth'

// 에이전트가 부르는 도구 → 진행 표시 문구
const TOOL_LABELS = {
  list_past_proposals: '지난 제안 확인',
  list_box_specs: '박스 규격 확인',
  list_product_fits: '상품·출고 이력 수집',
  get_box_inventory: '재고 확인',
  get_shipment_history: '월별 출고 수집',
  list_purchase_orders: '발주 이력 확인',
  forecast_shipments: '수요 예측',
  analyze_fill_rate: '충진율 분석',
  diagnose_inefficiency: '비효율 원인 분석',
  find_misfit_clusters: '애매한 치수 구간 찾기',
  ideal_box_dims: '이상 치수 계산',
  search_catalog: '기성품 박스 검색',
  coverage: '후보 박스 적합도 계산',
  simulate_boxset: '신규 규격 도입 효과 계산',
  plan_order: '주문 수량 계산',
  get_template: '제안서 양식 불러오기',
  search_policies: '사내 규정 검색',
  search_feedback_cases: '과거 반려 기록 검색',
  read_resource: '규정 원문 확인',
  render_proposal: '제안서 작성',
  save_proposal: '제안서 저장',
  add_feedback_case: '반려 기록 저장',
}

/**
 * 박스 주문 제안 AI 작업: 실행(202) → 진행 이벤트(SSE) → 승인 대기 → 승인·반려 → 완료.
 * 화면은 Spring 의 /ai-tasks 만 부른다(에이전트 서버 주소는 브라우저에 드러나지 않는다).
 */
export function useAgentTask({ onDone } = {}) {
  const task = ref(null)
  const phase = ref('idle') // idle · running · approval · done · failed
  const step = ref('')
  const toolCount = ref(0)
  const approval = ref(null)
  const error = ref('')
  let source = null

  const running = computed(() => phase.value === 'running' || phase.value === 'approval')

  function close() {
    source?.close()
    source = null
  }

  function listen(id) {
    close()
    source = new EventSource(apiUrl(`/warehouses/${auth.warehouseId.value}/ai-tasks/${id}/stream`), {
      withCredentials: true,
    })
    const data = (event) => JSON.parse(event.data || '{}')
    source.addEventListener('TOOL_START', (event) => {
      const { tool } = data(event)
      step.value = TOOL_LABELS[tool] ?? tool
      toolCount.value += 1
      if (phase.value !== 'approval') phase.value = 'running'
    })
    source.addEventListener('APPROVAL_REQUIRED', (event) => {
      approval.value = data(event)
      phase.value = 'approval'
    })
    source.addEventListener('DONE', async (event) => {
      close()
      phase.value = 'done'
      task.value = { ...task.value, result: data(event) }
      await onDone?.(data(event))
    })
    source.addEventListener('FAILED', (event) => {
      close()
      phase.value = 'failed'
      error.value = data(event).error ?? 'AI 개선 제안을 만들지 못했습니다.'
    })
    // 연결이 끊기면 브라우저가 Last-Event-ID 로 다시 붙는다. 끝난 작업이면 상태만 확인한다.
    source.onerror = async () => {
      if (!source || source.readyState !== EventSource.CLOSED) return
      try {
        const { data: latest } = await warehouseApi(`/ai-tasks/${id}`)
        if (latest.status === 'FAILED') {
          phase.value = 'failed'
          error.value = latest.failureMessage ?? ''
        }
      } catch {
        /* 다음 조회에서 다시 확인 */
      }
    }
  }

  async function start(targetMonth) {
    if (running.value) return
    error.value = ''
    approval.value = null
    step.value = '작업 접수'
    toolCount.value = 0
    phase.value = 'running'
    try {
      const { data } = await warehouseApi('/ai-tasks', { method: 'POST', body: { targetMonth } })
      task.value = data
      listen(data.id)
    } catch (cause) {
      phase.value = 'failed'
      error.value = cause.message
    }
  }

  async function decide(decision, comment = '') {
    if (phase.value !== 'approval') return
    try {
      await warehouseApi(`/ai-tasks/${task.value.id}/approval`, { method: 'POST', body: { decision, comment } })
      approval.value = null
      phase.value = 'running'
      step.value = decision === 'APPROVED' ? '제안서 저장' : '반려 의견 반영'
    } catch (cause) {
      error.value = cause.message
    }
  }

  onBeforeUnmount(close)

  return { task, phase, step, toolCount, approval, error, running, start, decide }
}
