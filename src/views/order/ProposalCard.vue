<script setup>
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import DataTable from '@/components/common/DataTable.vue'
import AgentApprovalPanel from './AgentApprovalPanel.vue'
import { auth } from '@/stores/auth'

// 다음 달 주문 제안서 카드. 계산 실행 · AI 개선 실행 · 발주서 반영까지 맡습니다.
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
  agentRunning: Boolean,
  agentFailed: Boolean,
  agentNotice: { type: String, default: '' },
  agentApproval: { type: Object, default: null },
})

const emit = defineEmits(['run-job', 'run-agent', 'apply', 'agent-decide'])

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
  <AppCard class="proposal">
    <template #header>
      <div class="card-title-row">
        <h2 class="card-title">박스 주문 제안서</h2>
        <span v-if="proposal" class="ai-tag">{{ proposal.baseline ? '참고 계산' : 'AI 생성' }}</span>
      </div>
    </template>

    <template #actions>
      <span v-if="proposal" class="card-meta">{{ proposal.createdAt }}</span>
      <AppButton size="sm" :disabled="!auth.canEdit.value || busy || jobRunning" @click="emit('run-job')">
        {{ jobRunning ? '계산 중…' : proposal ? '다시 계산' : '계산 실행' }}
      </AppButton>
      <AppButton size="sm" variant="primary" :disabled="!auth.canEdit.value || agentRunning" @click="emit('run-agent')">
        {{ agentRunning ? 'AI 실행 중…' : '개선 실행' }}
      </AppButton>
    </template>

    <p v-if="agentNotice" class="job-notice" :class="{ 'job-notice--error': agentFailed }" role="status">
      {{ agentNotice }}
    </p>

    <AgentApprovalPanel
      v-if="agentApproval"
      :approval="agentApproval"
      @decide="(decision, comment) => emit('agent-decide', decision, comment)"
    />

    <p v-if="jobNotice" class="job-notice" :class="{ 'job-notice--error': jobFailed }" role="status">
      {{ jobNotice }}
    </p>

    <template v-if="proposal">
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

      <AppButton
        class="proposal__apply"
        variant="secondary"
        block
        :disabled="!auth.canEdit.value || busy || !proposal.totalQty"
        @click="emit('apply')"
      >
        발주서에 반영하기 <span aria-hidden="true">→</span>
      </AppButton>
      <p v-if="!auth.canEdit.value" class="card-hint">발주서는 운영자 이상 권한으로 만들 수 있어요.</p>
    </template>

    <div v-else-if="loaded" class="empty-state">
      <p class="empty-state__title">{{ Number(targetMonth.slice(5)) }}월 제안서가 아직 없어요.</p>
      <p class="empty-state__text">
        [계산 실행]을 누르면 최근 관측 이력으로 참고 제안서를 만들어요. 활성 규격과 현재 재고·안전 재고·단가가 등록되어
        있어야 계산할 수 있어요.
      </p>
    </div>
  </AppCard>
</template>

<style scoped>
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

.proposal__apply {
  margin-top: 20px;
}
</style>
