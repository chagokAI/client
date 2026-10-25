<script setup>
import { computed, onMounted, ref } from 'vue'
import ApiState from '@/components/common/ApiState.vue'
import AppButton from '@/components/common/AppButton.vue'
import AppCard from '@/components/common/AppCard.vue'
import SelectField from '@/components/common/SelectField.vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'
import { api } from '@/api/client'
import { useRemote } from '@/composables/useRemote'
import { download } from './download'
import { markdownToHtml } from './markdown'

// 센터 박스 운용 지침서. 센터별로 조정할 수 있는 판단 기준을 고치면 저장 즉시 그 센터 지침서(규정 문서 숫자)와
// 다음 박스 주문 제안에 반영됩니다. 기본값과 같게 저장하면 센터 조정을 지웁니다.
const emit = defineEmits(['saved'])

const { loading, error, load } = useRemote()
const centers = ref([])
const centerId = ref('')
const guide = ref(null)
const draft = ref({})
const saving = ref(false)
const message = ref('')
const messageError = ref(false)
const docId = ref('')
const showAll = ref(false)
// 규정 문서 고치기(전 센터 공통). editing = { docId, markdown } 원문 틀({규칙 키} 자리 포함)
const editing = ref(null)
const docSaving = ref(false)
const docError = ref('')

const centerOptions = computed(() => centers.value.map((c) => ({ value: c.warehouseId, label: c.name })))
const centerName = computed(() => centers.value.find((c) => c.warehouseId === centerId.value)?.name ?? '')
const rules = computed(() => guide.value?.rules ?? [])
// 본부장이 주로 조정하는 3개(월 절감액·충진율 개선 폭·목형비 회수 기간)를 맨 위에, 나머지는 규정 문서별로 묶습니다.
const tuneRules = computed(() => rules.value.filter((r) => r.hqTune))
const docTitle = (id) => guide.value?.documents.find((d) => d.docId === id)?.title ?? id
const otherGroups = computed(() => {
  const groups = new Map()
  for (const rule of rules.value.filter((r) => !r.hqTune)) {
    const id = (rule.source ?? '').split(' ')[0] || '기타'
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id).push(rule)
  }
  return [...groups].map(([id, items]) => ({ id, title: docTitle(id), items }))
})

const changed = computed(() => rules.value.filter((r) => !same(draft.value[r.key], r.value)))
const overriddenCount = computed(() => rules.value.filter((r) => r.overridden).length)
const document = computed(() => guide.value?.documents.find((d) => d.docId === docId.value) ?? null)
const documentHtml = computed(() => (document.value ? markdownToHtml(document.value.markdown) : ''))

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function setGuide(data) {
  guide.value = data
  draft.value = Object.fromEntries(data.rules.map((r) => [r.key, r.value]))
  if (!data.documents.some((d) => d.docId === docId.value)) docId.value = data.documents[0]?.docId ?? ''
}

function refresh() {
  return load(
    (signal) => api('/admin/guides/centers', { signal }),
    ({ data }) => {
      centers.value = data.items ?? []
      if (!centerId.value && centers.value.length) selectCenter(centers.value[0].warehouseId)
    },
  )
}

async function selectCenter(id) {
  centerId.value = id
  message.value = ''
  guide.value = null
  try {
    const { data } = await api(`/admin/guides/${id}`)
    if (centerId.value === id) setGuide(data)
  } catch (cause) {
    showMessage(cause.message, true)
  }
}

function showMessage(text, isError = false) {
  message.value = text
  messageError.value = isError
}

// 입력값 → 규칙 형식(정수·소수·켜기/끄기·월 목록)
function setValue(rule, raw) {
  let value = raw
  if (rule.type === 'int' || rule.type === 'float') {
    value = raw === '' ? '' : Number(raw)
    if (rule.type === 'int' && value !== '') value = Math.round(value)
  } else if (rule.type === 'int_list') {
    value = String(raw)
      .split(/[,\s]+/)
      .filter(Boolean)
      .map(Number)
  }
  draft.value = { ...draft.value, [rule.key]: value }
}

function inputValue(rule) {
  const value = draft.value[rule.key]
  return Array.isArray(value) ? value.join(', ') : value
}

function step(rule) {
  if (rule.type === 'float') return rule.unit === '개월' ? 0.5 : 0.1
  if (rule.unit === '원') return 10000
  return 1
}

function outOfRange(rule) {
  const value = draft.value[rule.key]
  if (!rule.range || (rule.type !== 'int' && rule.type !== 'float')) return false
  return value === '' || Number.isNaN(value) || value < rule.range[0] || value > rule.range[1]
}

function fmt(rule, value) {
  if (rule.type === 'bool') return value ? '켜기' : '끄기'
  if (Array.isArray(value)) return `${value.join(', ')}${rule.unit ? ` ${rule.unit}` : ''}`
  return `${Number(value).toLocaleString('ko-KR')}${rule.unit ?? ''}`
}

const invalid = computed(() => changed.value.some(outOfRange))

function reset() {
  draft.value = Object.fromEntries(rules.value.map((r) => [r.key, r.value]))
  showMessage('')
}

async function save() {
  if (!changed.value.length || invalid.value || saving.value) return
  saving.value = true
  try {
    // 기본값과 같으면 null 로 보내 센터 조정을 지웁니다(기본값이 바뀌면 함께 따라가도록).
    const changes = Object.fromEntries(
      changed.value.map((r) => [r.key, same(draft.value[r.key], r.default) ? null : draft.value[r.key]]),
    )
    const { data } = await api(`/admin/guides/${centerId.value}`, { method: 'PATCH', body: { changes } })
    setGuide(data)
    showMessage(
      `${centerName.value} 기준 ${Object.keys(changes).length}건을 저장했어요. 다음 박스 주문 제안부터 적용돼요.`,
    )
    emit('saved')
  } catch (cause) {
    showMessage(cause.message, true)
  } finally {
    saving.value = false
  }
}

async function startEdit() {
  docError.value = ''
  try {
    const { data } = await api(`/admin/policies/${docId.value}`)
    editing.value = { docId: data.docId, markdown: data.markdown }
  } catch (cause) {
    showMessage(cause.message, true)
  }
}

async function saveDoc() {
  if (docSaving.value) return
  docSaving.value = true
  docError.value = ''
  try {
    await api(`/admin/policies/${editing.value.docId}`, { method: 'PUT', body: { markdown: editing.value.markdown } })
    const saved = editing.value.docId
    editing.value = null
    await selectCenter(centerId.value)
    docId.value = saved
    showMessage(`${saved} 문서를 고쳤어요. 모든 센터 지침서와 다음 제안서의 규정 인용에 반영돼요.`)
  } catch (cause) {
    docError.value = cause.message
  } finally {
    docSaving.value = false
  }
}

function saveDocuments() {
  const text = guide.value.documents.map((d) => d.markdown.trim()).join('\n\n---\n\n')
  download(`${centerName.value.replace(/\s+/g, '_')}_박스_운용_지침서.md`, `${text}\n`, 'text/markdown')
}

onMounted(refresh)
</script>

<template>
  <AppCard title="지침서">
    <template #actions>
      <div class="guide__actions">
        <SelectField
          v-if="centerOptions.length"
          :model-value="centerId"
          :options="centerOptions"
          aria-label="센터"
          width="140px"
          @update:model-value="selectCenter"
        />
        <AppButton size="sm" :disabled="!guide" @click="saveDocuments">내려받기</AppButton>
      </div>
    </template>

    <ApiState :loading="loading" :error="error" @retry="refresh" />

    <div v-if="guide" class="guide">
      <section class="guide__rules" aria-label="센터 판단 기준">
        <p class="guide__lead">
          {{ centerName }} 기준을 고치면 오른쪽 지침서와 다음 박스 주문 제안에 바로 반영돼요.
          <span v-if="overriddenCount" class="guide__badge">센터 조정 {{ overriddenCount }}건</span>
        </p>

        <h3 class="guide__group">주요 조정 항목</h3>
        <ul class="rules">
          <li
            v-for="rule in tuneRules"
            :key="rule.key"
            class="rule rule--main"
            :class="{ 'rule--changed': !same(draft[rule.key], rule.value) }"
          >
            <label class="rule__label" :for="`rule-${rule.key}`">{{ rule.label }}</label>
            <div class="rule__control">
              <input
                :id="`rule-${rule.key}`"
                class="rule__input"
                :class="{ 'rule__input--invalid': outOfRange(rule) }"
                type="number"
                :min="rule.range?.[0]"
                :max="rule.range?.[1]"
                :step="step(rule)"
                :value="inputValue(rule)"
                @input="setValue(rule, $event.target.value)"
              />
              <span class="rule__unit">{{ rule.unit }}</span>
            </div>
            <p class="rule__meta">
              기본 {{ fmt(rule, rule.default) }}
              <template v-if="rule.range"> · {{ fmt(rule, rule.range[0]) }} ~ {{ fmt(rule, rule.range[1]) }}</template>
              <button
                v-if="!same(draft[rule.key], rule.default)"
                type="button"
                class="rule__reset"
                @click="setValue(rule, rule.default)"
              >
                기본값으로
              </button>
            </p>
          </li>
        </ul>

        <button type="button" class="guide__more" :aria-expanded="showAll" @click="showAll = !showAll">
          {{ showAll ? '기타 기준 접기' : `기타 기준 ${rules.length - tuneRules.length}개 보기` }}
        </button>

        <template v-if="showAll">
          <section v-for="group in otherGroups" :key="group.id">
            <h3 class="guide__group">{{ group.title }}</h3>
            <ul class="rules">
              <li
                v-for="rule in group.items"
                :key="rule.key"
                class="rule"
                :class="{ 'rule--changed': !same(draft[rule.key], rule.value) }"
              >
                <label class="rule__label" :for="`rule-${rule.key}`">{{ rule.label }}</label>
                <div class="rule__control">
                  <ToggleSwitch
                    v-if="rule.type === 'bool'"
                    :model-value="draft[rule.key]"
                    :aria-label="rule.label"
                    @update:model-value="setValue(rule, $event)"
                  />
                  <template v-else>
                    <input
                      :id="`rule-${rule.key}`"
                      class="rule__input"
                      :class="{ 'rule__input--invalid': outOfRange(rule) }"
                      :type="rule.type === 'int_list' ? 'text' : 'number'"
                      :min="rule.range?.[0]"
                      :max="rule.range?.[1]"
                      :step="step(rule)"
                      :value="inputValue(rule)"
                      @input="setValue(rule, $event.target.value)"
                    />
                    <span class="rule__unit">{{ rule.unit }}</span>
                  </template>
                </div>
                <p class="rule__meta">
                  기본 {{ fmt(rule, rule.default) }}
                  <button
                    v-if="!same(draft[rule.key], rule.default)"
                    type="button"
                    class="rule__reset"
                    @click="setValue(rule, rule.default)"
                  >
                    기본값으로
                  </button>
                </p>
              </li>
            </ul>
          </section>
        </template>

        <div class="guide__save">
          <p v-if="message" class="guide__message" :class="{ 'guide__message--error': messageError }" role="status">
            {{ message }}
          </p>
          <p v-else-if="invalid" class="guide__message guide__message--error">범위를 벗어난 값이 있어요.</p>
          <div class="guide__buttons">
            <AppButton :disabled="!changed.length || saving" @click="reset">되돌리기</AppButton>
            <AppButton variant="primary" :disabled="!changed.length || invalid || saving" @click="save">
              {{ saving ? '저장 중…' : changed.length ? `변경 ${changed.length}건 저장` : '저장' }}
            </AppButton>
          </div>
        </div>
      </section>

      <section class="guide__doc" aria-label="센터 지침서 미리보기">
        <div class="doc-tabs" role="tablist">
          <button
            v-for="doc in guide.documents"
            :key="doc.docId"
            type="button"
            role="tab"
            class="doc-tabs__tab"
            :class="{ 'doc-tabs__tab--active': doc.docId === docId }"
            :aria-selected="doc.docId === docId"
            :disabled="Boolean(editing)"
            @click="docId = doc.docId"
          >
            {{ doc.docId }}
          </button>
          <button v-if="!editing" type="button" class="doc-tabs__edit" @click="startEdit">수정하기</button>
        </div>

        <div v-if="editing" class="doc-edit">
          <p class="doc-edit__hint">
            모든 센터가 함께 쓰는 문서예요. <code>{규칙 키}</code> 자리는 센터마다 왼쪽 기준값으로 채워지니 그대로
            두세요.
          </p>
          <textarea
            v-model="editing.markdown"
            class="doc-edit__text"
            spellcheck="false"
            :aria-label="`${editing.docId} 원문`"
          />
          <p v-if="docError" class="guide__message guide__message--error" role="alert">{{ docError }}</p>
          <div class="guide__buttons">
            <AppButton :disabled="docSaving" @click="editing = null">취소</AppButton>
            <AppButton variant="primary" :disabled="docSaving" @click="saveDoc">
              {{ docSaving ? '저장 중…' : '문서 저장' }}
            </AppButton>
          </div>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -- markdownToHtml 이 글자를 모두 이스케이프한 뒤 태그만 붙인다 -->
        <article v-else class="doc" v-html="documentHtml" />
      </section>
    </div>
  </AppCard>
</template>

<style scoped>
.guide__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.guide {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: start;
}

.guide__lead {
  margin: 0 0 4px;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.5;
  word-break: keep-all;
}

.guide__badge {
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--color-cream);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.guide__group {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 700;
}

.rules {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rule {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
}

.rule--main {
  background: var(--color-cream);
}

.rule--changed {
  border-color: var(--color-gold);
}

.rule__label {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  word-break: keep-all;
}

.rule__control {
  display: flex;
  align-items: center;
  gap: 6px;
}

.rule__input {
  box-sizing: border-box;
  width: 110px;
  padding: 6px 8px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-sm);
  background: var(--color-white);
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.rule__input--invalid {
  border-color: var(--color-danger-text);
}

.rule__unit {
  min-width: 28px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.rule__meta {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11px;
}

.rule__reset,
.guide__more {
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}

.rule__reset {
  margin-left: 6px;
  font-size: 11px;
}

.guide__more {
  margin-top: 14px;
  font-size: 12px;
}

.guide__save {
  position: sticky;
  bottom: 0;
  margin-top: 16px;
  padding: 12px 0 4px;
  background: var(--color-white);
}

.guide__message {
  margin: 0 0 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  word-break: keep-all;
}

.guide__message--error {
  color: var(--color-danger-text);
}

.guide__buttons {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 2fr;
}

.doc-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.doc-tabs__tab {
  padding: 5px 10px;
  border: 1px solid var(--color-card-border);
  border-radius: 999px;
  background: none;
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.doc-tabs__edit {
  margin-left: auto;
  padding: 5px 2px;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.doc-tabs__edit:hover {
  color: var(--color-text-secondary);
  text-decoration: underline;
}

.doc-edit {
  display: grid;
  gap: 10px;
}

.doc-edit__hint {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.5;
  word-break: keep-all;
}

.doc-edit__hint code {
  padding: 0 4px;
  border-radius: 4px;
  background: var(--color-cream);
  font-size: 11px;
}

.doc-edit__text {
  box-sizing: border-box;
  width: 100%;
  min-height: 520px;
  padding: 12px 14px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  font:
    12px/1.6 ui-monospace,
    'SF Mono',
    Menlo,
    monospace;
  resize: vertical;
}

.doc-tabs__tab--active {
  border-color: var(--color-gold);
  background: var(--color-cream);
  color: var(--color-text);
  font-weight: 700;
}

.doc {
  max-height: 720px;
  overflow-y: auto;
  padding: 16px 18px;
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-md);
  font-size: 12.5px;
  line-height: 1.65;
  word-break: keep-all;
}

.doc :deep(h3) {
  margin: 0 0 10px;
  font-size: 15px;
}

.doc :deep(h4) {
  margin: 16px 0 6px;
  font-size: 13px;
}

.doc :deep(p) {
  margin: 0 0 6px;
}

.doc :deep(ul) {
  margin: 0 0 8px;
  padding-left: 18px;
}

@media (max-width: 1180px) {
  .guide {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
