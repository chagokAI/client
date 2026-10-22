<script setup>
import { ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import { currency } from '@/api/format'

// AI가 만든 제안서 초안을 담당자가 승인하거나, 의견을 적어 다시 쓰게 하는 패널입니다.
defineProps({
  approval: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['decide'])
const comment = ref('')

function decide(decision) {
  emit('decide', decision, decision === 'REJECTED' ? comment.value.trim() : '')
  if (decision === 'REJECTED') comment.value = ''
}
</script>

<template>
  <section class="agent-approval" aria-label="AI 제안서 승인">
    <h3 class="agent-approval__title">AI 개선 제안서 승인 요청</h3>
    <p class="agent-approval__summary">
      총 {{ approval.qty?.toLocaleString() }}개 · {{ currency(approval.totalAmount) }}
      <template v-if="approval.newSpecs?.length">
        · 신규 규격 {{ approval.newSpecs.join(', ') }}
      </template>
      · 자체 검토 {{ approval.score }}점
    </p>

    <details class="agent-approval__body">
      <summary>제안서 초안 보기</summary>
      <pre>{{ approval.proposalMarkdown }}</pre>
    </details>

    <ul v-if="approval.sources?.length" class="agent-approval__sources">
      <li v-for="item in approval.sources" :key="item.sourceId">
        <strong>{{ item.sourceId }}</strong> {{ item.title }}
      </li>
    </ul>

    <textarea
      v-model="comment"
      class="agent-approval__comment"
      rows="2"
      maxlength="500"
      placeholder="반려 의견 (예: 안전 재고 넉넉하게, 신규 규격은 빼고)"
    />

    <div class="agent-approval__actions">
      <AppButton size="sm" variant="danger-outline" :disabled="!comment.trim()" @click="decide('REJECTED')">
        반려하고 다시 작성
      </AppButton>
      <AppButton size="sm" variant="primary" @click="decide('APPROVED')">승인하고 저장</AppButton>
    </div>
  </section>
</template>

<style scoped>
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
</style>
