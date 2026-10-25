<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import DataTable from '@/components/common/DataTable.vue'
import SelectField from '@/components/common/SelectField.vue'
import { auth } from '@/stores/auth'

// 다음 달 주문 제안서 카드. 제안서 생성 · 발주서 반영을 맡습니다.
const props = defineProps({
  // proposalModel() 결과. 아직 제안서가 없으면 null 입니다.
  proposal: { type: Object, default: null },
  comparisons: { type: Array, default: () => [] },
  // 제안서 조회가 끝났는지. 끝났는데 proposal 이 없으면 '아직 없어요' 안내를 보여 줍니다.
  loaded: Boolean,
  targetMonth: { type: String, required: true },
  busy: Boolean,
  jobRunning: Boolean,
  jobFailed: Boolean,
  jobNotice: { type: String, default: '' },
  // AI 에이전트 작업이 승인 대기인지, 그 초안 { html, totalAmount, newSpecs }
  reviewing: Boolean,
  review: { type: Object, default: null },
  // 에이전트가 끝낸 단계 결과 문장 [{ id, text }]와 진행 단계 { done, total }
  progress: { type: Array, default: () => [] },
  stepCount: { type: Object, default: () => ({ done: 0, total: 0 }) },
  // 대상 월 드롭다운 { value, label }[]과 보고 있는 월. 지난 달 제안서는 보기 전용(readonly)입니다.
  monthOptions: { type: Array, default: () => [] },
  viewMonth: { type: String, default: '' },
  readonly: Boolean,
})

const emit = defineEmits(['run-job', 'apply', 'decide', 'update:viewMonth'])

// 반려는 다시 작성할 방향이 필요해 의견을 받아야 보냅니다.
const comment = ref('')
function decide(decision) {
  emit('decide', { decision, comment: comment.value.trim() })
  comment.value = ''
}

// 제안서 HTML 이 보내 주는 내용 높이만큼 틀을 늘려 안쪽 스크롤 없이 보여 줍니다.
const frame = ref(null)
const frameHeight = ref(560)
function onFrameMessage(event) {
  if (event.source !== frame.value?.contentWindow || event.data?.type !== 'chagok-proposal-height') return
  frameHeight.value = Math.max(320, Math.ceil(event.data.height))
}
onMounted(() => window.addEventListener('message', onFrameMessage))
onBeforeUnmount(() => window.removeEventListener('message', onFrameMessage))

// 재방문·새로고침에서도 서버에 저장된 제안서를 바로 보여 줍니다.
const shown = computed(() => Boolean(props.proposal))

function generate() {
  emit('run-job')
}

const proposalColumns = [
  { key: 'code', label: '규격', width: '16%' },
  { key: 'current', label: '현재 재고', width: '21%', align: 'right' },
  { key: 'expected', label: '대상 월 참고 소모', width: '25%', align: 'right' },
  { key: 'safety', label: '안전 재고', width: '19%', align: 'right' },
  { key: 'suggested', label: '제안 수량', width: '19%', align: 'right' },
]

const effectColumns = [
  { key: 'metric', label: '항목', width: '34%' },
  { key: 'before', label: '기존 박스', width: '24%', align: 'right' },
  { key: 'after', label: '도입 후', width: '24%', align: 'right' },
  { key: 'change', label: '변화', width: '18%', align: 'right' },
]
</script>

<template>
  <AppCard class="proposal" title="박스 주문 제안서">
    <template #actions>
      <div class="proposal__header">
        <span v-if="shown" class="card-meta">{{ proposal.createdAt }}</span>
        <SelectField
          v-if="monthOptions.length > 1"
          :model-value="viewMonth"
          :options="monthOptions"
          aria-label="제안서 대상 월"
          width="150px"
          @update:model-value="emit('update:viewMonth', $event)"
        />
      </div>
    </template>

    <p v-if="jobNotice && !readonly" class="job-notice" :class="{ 'job-notice--error': jobFailed }" role="status">
      {{ jobNotice }}
    </p>

    <section v-if="jobRunning && progress.length && !readonly" class="progress" aria-label="AI 에이전트 진행 상황">
      <p v-if="stepCount.total" class="progress__count">{{ stepCount.done }}/{{ stepCount.total }} 단계</p>
      <ol class="progress__list">
        <li v-for="item in progress" :key="item.id">{{ item.text }}</li>
      </ol>
    </section>

    <section v-if="reviewing && !readonly" class="review" aria-label="승인 대기 제안서 초안">
      <iframe
        v-if="review?.html"
        ref="frame"
        class="review__frame"
        :style="{ height: `${frameHeight}px` }"
        title="박스 주문 제안서 초안"
        sandbox="allow-scripts"
        :srcdoc="review.html"
      />
      <p v-else class="review__empty">초안을 불러오는 중이에요. 잠시 후에도 보이지 않으면 새로 고침해 주세요.</p>
      <textarea
        v-model="comment"
        class="review__comment"
        rows="2"
        maxlength="500"
        placeholder="반려 의견 (예: 맞춤 규격은 빼고 기성품만 제안해 주세요)"
        :disabled="!auth.canEdit.value || busy"
      />
      <div class="proposal__actions">
        <AppButton
          variant="secondary"
          block
          :disabled="!auth.canEdit.value || busy || !comment.trim()"
          @click="decide('REJECTED')"
        >
          반려하고 다시 작성
        </AppButton>
        <AppButton variant="primary" block :disabled="!auth.canEdit.value || busy" @click="decide('APPROVED')">
          승인하고 발주서 만들기
        </AppButton>
      </div>
    </section>

    <!-- 에이전트 제안서는 확정 양식 HTML 하나로 보여 준다(표·근거를 따로 그리지 않음) -->
    <iframe
      v-else-if="shown && proposal.html"
      ref="frame"
      class="review__frame"
      :style="{ height: `${frameHeight}px` }"
      title="박스 주문 제안서"
      sandbox="allow-scripts"
      :srcdoc="proposal.html"
    />

    <template v-else-if="shown">
      <div class="proposal__headline">
        <p class="proposal__headline-text">{{ proposal.headline }}</p>
        <p class="proposal__headline-sub">{{ proposal.subline }}</p>
      </div>

      <DataTable
        class="proposal__table"
        :columns="proposalColumns"
        :rows="proposal.rows"
        row-key="id"
        min-width="480px"
      >
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

      <section v-if="proposal.effect" class="rationale">
        <h3 class="rationale__title">신규 규격 도입 효과</h3>
        <DataTable :columns="effectColumns" :rows="proposal.effect.rows" row-key="metric" min-width="480px" />
      </section>

      <section v-if="proposal.sources?.length" class="rationale">
        <h3 class="rationale__title">근거</h3>
        <ul class="rationale__list">
          <li v-for="item in proposal.sources" :key="item.sourceId">{{ item.sourceId }} · {{ item.title }}</li>
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
    </template>

    <div v-else-if="loaded && !jobRunning && !reviewing" class="empty-state">
      <p class="empty-state__title">{{ Number((viewMonth || targetMonth).slice(5)) }}월 제안서가 아직 없어요.</p>
      <p v-if="!readonly" class="empty-state__text">
        [제안서 생성하기]를 누르면 AI 에이전트가 최근 출고 이력으로 주문 수량과 신규 규격을 분석해 초안을 만들어요.
        초안을 승인하면 제안서로 저장돼요.
      </p>
    </div>

    <div v-if="!reviewing && !readonly" class="proposal__actions">
      <AppButton
        variant="primary"
        block
        :disabled="!auth.canEdit.value || busy || jobRunning || reviewing"
        @click="generate"
      >
        {{ jobRunning ? 'AI 에이전트 작업 중…' : reviewing ? '승인 대기 중' : '제안서 생성하기' }}
      </AppButton>
      <AppButton
        variant="secondary"
        block
        :disabled="!auth.canEdit.value || busy || !shown || !proposal.totalQty"
        @click="emit('apply')"
      >
        발주서 생성하기 <span aria-hidden="true">→</span>
      </AppButton>
    </div>

    <p v-if="!auth.canEdit.value" class="card-hint">발주서는 운영자 이상 권한으로 만들 수 있어요.</p>
  </AppCard>
</template>

<style scoped>
.card-hint {
  margin: 8px 0 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  text-align: center;
}

.proposal__header {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 에이전트 진행 상황 */
.progress {
  margin-bottom: 16px;
}

.progress__count {
  margin: 0 0 8px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.progress__list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}

.progress__list li {
  position: relative;
  padding-left: 18px;
  word-break: keep-all;
}

.progress__list li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--color-gold);
  font-weight: 700;
}

/* 승인 대기 초안 */
.review {
  margin-bottom: 20px;
}

.review__frame {
  display: block;
  width: 100%;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: #fff;
}

.review__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.review__comment {
  box-sizing: border-box;
  width: 100%;
  margin-top: 12px;
  padding: 10px 12px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  font: inherit;
  font-size: 12px;
  resize: vertical;
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

.proposal__actions {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 20px;
}
</style>
