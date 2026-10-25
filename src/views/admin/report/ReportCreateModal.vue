<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import SelectField from '@/components/common/SelectField.vue'
import { api } from '@/api/client'

// 본부 리포트 만들기. 리포트는 승인된 박스 주문 제안의 효과를 모으므로, 먼저 센터별 제안서 현황을 보여 주고
// 그 월까지 제안서가 있는 센터가 한 곳 이상일 때 만들 수 있게 합니다.
const emit = defineEmits(['close', 'created'])

// 지난 6개월(이번 달 포함). 기본은 지난달(마감된 달)
const monthOptions = (() => {
  const now = new Date()
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { value, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월${i === 0 ? ' (진행 중)' : ''}` }
  })
})()
const month = ref(monthOptions[1].value)
const readiness = ref(null)
const checking = ref(false)
const task = ref(null)
const busy = ref(false)
const message = ref('')

const running = computed(() => task.value?.status === 'RUNNING')
const waiting = computed(() => task.value?.status === 'WAITING_APPROVAL')
const actions = computed(() => task.value?.pending?.actions ?? [])
const canCreate = computed(() => readiness.value?.readyCount > 0 && !task.value && !busy.value)

async function check(next) {
  if (task.value) return // 만드는 중에는 월을 바꾸지 않습니다
  month.value = next
  readiness.value = null
  message.value = ''
  checking.value = true
  try {
    const { data } = await api('/admin/hq-reports/readiness', { query: { month: next } })
    if (month.value === next) readiness.value = data
  } catch (cause) {
    message.value = cause.message
  } finally {
    checking.value = false
  }
}

let timer = null
async function poll() {
  try {
    const { data } = await api(`/admin/hq-reports/tasks/${task.value.taskId}`)
    task.value = data
    if (data.status === 'RUNNING') timer = setTimeout(poll, 3000)
    else if (data.status === 'DONE') finish('리포트를 만들었어요.')
    else if (data.status === 'FAILED')
      message.value = `리포트를 만들지 못했어요 · ${data.error ?? '원인을 확인할 수 없어요.'}`
  } catch (cause) {
    message.value = cause.message
  }
}

async function create() {
  if (!canCreate.value) return
  busy.value = true
  message.value = ''
  try {
    const { data } = await api('/admin/hq-reports', { method: 'POST', body: { month: month.value } })
    task.value = { taskId: data.taskId, status: 'RUNNING' }
    timer = setTimeout(poll, 3000)
  } catch (cause) {
    message.value = cause.message
  } finally {
    busy.value = false
  }
}

// 조치(센터 규칙 변경)는 승인해야 반영됩니다. 리포트 파일은 승인 전에 이미 만들어져 있습니다.
async function decide(decision) {
  busy.value = true
  try {
    await api(`/admin/hq-reports/tasks/${task.value.taskId}/approval`, { method: 'POST', body: { decision } })
    task.value = { ...task.value, status: 'RUNNING' }
    timer = setTimeout(poll, 1500)
  } catch (cause) {
    message.value = cause.message
  } finally {
    busy.value = false
  }
}

function finish(text) {
  emit('created', { month: month.value, message: text })
}

onMounted(() => check(month.value))
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <BaseModal
    title="리포트 만들기"
    description="승인된 박스 주문 제안서의 효과를 센터별로 모아 본부 리포트를 만들어요."
    width="640px"
    @close="emit('close')"
  >
    <div class="create">
      <SelectField
        :model-value="month"
        :options="monthOptions"
        label="리포트 월"
        width="200px"
        @update:model-value="check"
      />

      <p v-if="checking" class="create__hint">센터별 제안서 현황을 확인하고 있어요.</p>

      <template v-else-if="readiness">
        <p class="create__summary">
          <strong>{{ readiness.total }}곳 중 {{ readiness.readyCount }}곳</strong>에 {{ Number(month.slice(5)) }}월까지
          저장된 제안서가 있어요
          <span class="create__sub">· {{ Number(month.slice(5)) }}월 대상 제안서 {{ readiness.thisMonthCount }}곳</span>
        </p>
        <ul class="centers">
          <li
            v-for="center in readiness.centers"
            :key="center.warehouseId"
            class="centers__item"
            :class="{ 'centers__item--empty': !center.proposalMonths }"
          >
            <span class="centers__name">{{ center.name.replace(' 센터', '') }}</span>
            <span class="centers__state">
              {{
                center.proposalMonths
                  ? `제안 ${center.proposalMonths}회 · 최근 ${Number(center.latestMonth.slice(5))}월`
                  : '제안서 없음'
              }}
            </span>
          </li>
        </ul>
        <p v-if="!readiness.readyCount" class="create__hint">
          제안서가 있는 센터가 없어 만들 수 없어요. 센터에서 박스 주문 제안서를 승인하면 만들 수 있어요.
        </p>
      </template>

      <p v-if="running" class="create__status" role="status">
        센터별 실적을 모아 리포트를 만들고 있어요. 1~2분 걸려요.
      </p>

      <section v-if="waiting" class="pending" aria-label="승인할 조치">
        <p class="create__status">리포트를 만들었어요. 아래 조치는 승인해야 다음 제안서부터 반영돼요.</p>
        <ul class="pending__list">
          <li v-for="action in actions" :key="action.warehouseId">
            <strong>{{ action.center.replace(' 센터', '') }}</strong> {{ action.reason }}
          </li>
        </ul>
      </section>

      <p v-if="message" class="create__hint create__hint--error" role="alert">{{ message }}</p>
    </div>

    <template #footer>
      <template v-if="waiting">
        <AppButton :disabled="busy" @click="decide('REJECTED')">조치 없이 마치기</AppButton>
        <AppButton variant="primary" :disabled="busy" @click="decide('APPROVED')">조치 승인</AppButton>
      </template>
      <template v-else>
        <AppButton @click="emit('close')">닫기</AppButton>
        <AppButton variant="primary" :disabled="!canCreate" @click="create">
          {{ running ? '만드는 중…' : '리포트 만들기' }}
        </AppButton>
      </template>
    </template>
  </BaseModal>
</template>

<style scoped>
.create {
  display: grid;
  gap: 14px;
}

.create__summary {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.create__sub {
  color: var(--color-text-muted);
  font-size: 12px;
}

.create__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.create__hint--error {
  color: var(--color-danger-text);
}

.create__status {
  margin: 0;
  padding: 10px 12px;
  border-radius: var(--radius-md);
  background: var(--color-info-bg);
  color: var(--color-info-text);
  font-size: 12px;
}

.centers {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.centers__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  background: var(--color-cream-soft);
}

.centers__item--empty {
  background: none;
  opacity: 0.6;
}

.centers__name {
  font-size: 12px;
  font-weight: 700;
}

.centers__state {
  color: var(--color-text-secondary);
  font-size: 11px;
}

.pending__list {
  display: grid;
  gap: 6px;
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 12px;
}
</style>
