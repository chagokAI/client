<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ApiState from '@/components/common/ApiState.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import SelectField from '@/components/common/SelectField.vue'
import { api } from '@/api/client'
import { useRemote } from '@/composables/useRemote'
import { download } from './download'
import ReportCreateModal from './ReportCreateModal.vue'

// 본부 통합 효율화 리포트. AI 에이전트(본부 리포트 에이전트)가 만든 월별 HTML 을 그대로 보여 주고 내려받습니다.
const { loading, error, load } = useRemote()
const months = ref([])
const month = ref('')
const html = ref('')
const htmlLoading = ref(false)
const htmlError = ref('')
const creating = ref(false)
const notice = ref('')

const monthOptions = computed(() =>
  months.value.map((m) => ({ value: m.month, label: `${m.month.slice(0, 4)}년 ${Number(m.month.slice(5))}월` })),
)

function refresh() {
  return load(
    (signal) => api('/admin/hq-reports', { signal }),
    ({ data }) => {
      months.value = data.items ?? []
      if (!months.value.some((m) => m.month === month.value)) selectMonth(months.value[0]?.month ?? '')
    },
  )
}

async function selectMonth(next) {
  month.value = next
  html.value = ''
  htmlError.value = ''
  if (!next) return
  htmlLoading.value = true
  try {
    const { data } = await api(`/admin/hq-reports/${next}`)
    if (month.value === next) html.value = data.html
  } catch (cause) {
    htmlError.value = cause.message
  } finally {
    htmlLoading.value = false
  }
}

async function onCreated({ month: created, message }) {
  creating.value = false
  notice.value = message
  await refresh()
  selectMonth(created)
}

function save() {
  download(`본부_효율화_리포트_${month.value}.html`, html.value, 'text/html')
}

// 리포트 HTML 이 보내 주는 내용 높이만큼 틀을 늘려 안쪽 스크롤 없이 보여 줍니다.
const frame = ref(null)
const frameHeight = ref(720)
function onFrameMessage(event) {
  if (event.source !== frame.value?.contentWindow || event.data?.type !== 'chagok-report-height') return
  frameHeight.value = Math.max(360, Math.ceil(event.data.height))
}
onMounted(() => {
  window.addEventListener('message', onFrameMessage)
  refresh()
})
onBeforeUnmount(() => window.removeEventListener('message', onFrameMessage))
</script>

<template>
  <AppCard title="센터별 리포트">
    <template #actions>
      <div class="report__actions">
        <SelectField
          v-if="monthOptions.length"
          :model-value="month"
          :options="monthOptions"
          aria-label="리포트 월"
          width="140px"
          @update:model-value="selectMonth"
        />
        <AppButton size="sm" variant="ghost" @click="creating = true">리포트 만들기</AppButton>
        <AppButton size="sm" :disabled="!html" @click="save">내려받기</AppButton>
      </div>
    </template>

    <ApiState :loading="loading" :error="error" @retry="refresh" />
    <p v-if="notice" class="report__hint report__hint--done" role="status">{{ notice }}</p>

    <div v-if="!loading && !error && !months.length" class="empty-state">
      <p class="empty-state__title">아직 만든 리포트가 없어요.</p>
      <p class="empty-state__text">본부 리포트 에이전트가 월말에 센터별 성과를 모아 리포트를 만들면 여기에 보여요.</p>
    </div>

    <p v-else-if="htmlLoading" class="report__hint">리포트를 불러오고 있어요.</p>
    <p v-else-if="htmlError" class="report__hint report__hint--error">{{ htmlError }}</p>
    <iframe
      v-else-if="html"
      ref="frame"
      class="report__frame"
      :style="{ height: `${frameHeight}px` }"
      :title="`${month} 본부 효율화 리포트`"
      sandbox="allow-scripts"
      :srcdoc="html"
    />
    <ReportCreateModal v-if="creating" @close="creating = false" @created="onCreated" />
  </AppCard>
</template>

<style scoped>
.report__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.report__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.report__hint--done {
  margin-bottom: 10px;
  color: var(--color-success-text);
}

.report__hint--error {
  color: var(--color-danger-text);
}

.report__frame {
  display: block;
  width: 100%;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  background: #fff;
  overflow: hidden;
}
</style>
