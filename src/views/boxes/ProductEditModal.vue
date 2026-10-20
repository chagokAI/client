<script setup>
import { computed, reactive } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FormField from '@/components/common/FormField.vue'
import InlineNotice from '@/components/common/InlineNotice.vue'
import OptionCard from '@/components/common/OptionCard.vue'
import SelectField from '@/components/common/SelectField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TextInput from '@/components/common/TextInput.vue'


const props = defineProps({
  categories: { type: Array, default: () => [] },
  busy: Boolean,
  product: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'save', 'deactivate'])

const candidates = (props.product.matchCandidates ?? []).map(c => ({ id: c.boxSpec.id,
  label: `${c.boxSpec.code} · ${c.boxSpec.name}`, dimensions: `${c.boxSpec.innerWidthMm} × ${c.boxSpec.innerDepthMm} × ${c.boxSpec.innerHeightMm} mm`,
  fillRate: c.fillRatePct, source: c.recommended ? 'dimensions' : '', note: '' }))
const categoryOptions = props.categories

const form = reactive({
  name: props.product.name,
  category: props.product.categoryId ?? '',
  weight: props.product.weightG ?? '',
  width: props.product.widthMm ?? '',
  depth: props.product.depthMm ?? '',
  height: props.product.heightMm ?? '',
  matchedBoxId: props.product.matchedBoxSpec?.id ?? '',
  manualReason: props.product.matchOverrideReason ?? '',
})

// 기존 매칭을 바꾸면 사유를 남깁니다.
const isManualPick = computed(() => form.matchedBoxId && form.matchedBoxId !== props.product.matchedBoxSpec?.id)

function badgeOf(candidate) {
  if (candidate.source === 'dimensions') return { label: '치수 추천', tone: 'gold' }
  if (candidate.id === form.matchedBoxId) return { label: '직접 지정', tone: 'info' }
  return { label: '', tone: 'neutral' }
}

// 포장공간비율은 85% 이상 정상 · 70% 이상 주의 · 그 아래 부적합
function rateTone(value) {
  if (value >= 85) return 'info'
  if (value >= 70) return 'warning'
  return 'danger'
}

function handleSave() {
  if (props.busy) return
  if (isManualPick.value && !form.manualReason.trim()) return
  emit('save', { ...form })
}
</script>

<template>
  <BaseModal
    title="상품 수정"
    :description="`${product.name} · ${product.code}`"
    width="760px"
    @close="emit('close')"
  >
    <template #title-badge>
      <StatusBadge :label="product.status" />
    </template>

    <form class="product-edit" novalidate @submit.prevent="handleSave">
      <div class="product-edit__identity">
        <button class="product-edit__image" type="button" disabled title="이미지 업로드 연결 준비 중">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" />
            <circle cx="8.5" cy="10" r="1.5" fill="currentColor" />
            <path d="m4 17 5-4.5 4 3.5 3-2.5 4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
          <span>이미지 변경</span>
        </button>

        <div class="product-edit__identity-fields">
          <FormField v-slot="{ fieldId }" label="상품명" required>
            <TextInput :id="fieldId" v-model="form.name" aria-label="상품명" />
          </FormField>

          <FormField v-slot="{ fieldId }" label="상품코드">
            <TextInput :id="fieldId" :model-value="product.code" readonly aria-label="상품코드" />
          </FormField>

          <FormField v-slot="{ fieldId }" label="카테고리" required>
            <SelectField :id="fieldId" v-model="form.category" :options="categoryOptions" width="100%" aria-label="카테고리" />
          </FormField>

          <FormField v-slot="{ fieldId }" label="무게">
            <TextInput :id="fieldId" v-model="form.weight" suffix="g" format-number aria-label="무게" />
          </FormField>
        </div>
      </div>

      <FormField label="상품 사이즈 (mm)" required hint="등록된 치수예요. 실제와 다르면 고쳐주세요.">
        <div class="product-edit__dimensions">
          <TextInput v-model="form.width" suffix="가로" format-number aria-label="가로 (mm)" />
          <span class="product-edit__times" aria-hidden="true">×</span>
          <TextInput v-model="form.depth" suffix="세로" format-number aria-label="세로 (mm)" />
          <span class="product-edit__times" aria-hidden="true">×</span>
          <TextInput v-model="form.height" suffix="높이" format-number aria-label="높이 (mm)" />
        </div>
      </FormField>

      <section class="product-edit__matching">
        <header class="product-edit__matching-head">
          <h3 class="product-edit__matching-title">매칭 택배 상자</h3>
          <span class="product-edit__matching-sort">포장공간비율 높은 순</span>
        </header>

        <div class="product-edit__candidates">
          <OptionCard
            v-for="candidate in candidates"
            :key="candidate.id"
            v-model="form.matchedBoxId"
            name="matched-box"
            :value="candidate.id"
            :title="candidate.label"
            :subtitle="candidate.note ? `${candidate.dimensions} · ${candidate.note}` : candidate.dimensions"
            :badge="badgeOf(candidate).label"
            :badge-tone="badgeOf(candidate).tone"
            :rate="candidate.fillRate"
            :rate-tone="rateTone(candidate.fillRate)"
          />
        </div>
      </section>

      <FormField v-if="isManualPick" v-slot="{ fieldId }" label="직접 지정 사유" required>
        <TextInput
          :id="fieldId"
          v-model="form.manualReason"
          placeholder="이 상자를 직접 지정하는 이유를 적어주세요"
          aria-label="직접 지정 사유"
        />
      </FormField>

      <InlineNotice>저장하면 치수에 맞춰 적합 여부와 포장공간비율을 다시 계산해요.</InlineNotice>
    </form>

    <template #footer>
      <button class="product-edit__deactivate" type="button" @click="emit('deactivate')">상품 비활성화</button>
      <AppButton @click="emit('close')">취소</AppButton>
      <AppButton variant="primary" :disabled="busy || (isManualPick && !form.manualReason.trim())" @click="handleSave">저장하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.product-edit {
  display: grid;
  gap: 18px;
}

.product-edit__identity {
  display: grid;
  gap: 16px;
  grid-template-columns: 124px minmax(0, 1fr);
}

.product-edit__image {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  aspect-ratio: 1;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-cream-strong);
  color: var(--color-brown);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: filter 160ms ease;
}

.product-edit__image:hover {
  filter: brightness(0.97);
}

.product-edit__image svg {
  width: 28px;
  height: 28px;
}

.product-edit__identity-fields {
  display: grid;
  gap: 14px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.product-edit__dimensions {
  display: grid;
  align-items: center;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr) auto minmax(0, 1fr);
}

.product-edit__times {
  color: var(--color-text-muted);
  font-size: 13px;
}

.product-edit__matching-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.product-edit__matching-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.4;
}

.product-edit__matching-sort {
  color: var(--color-text-muted);
  font-size: 12px;
}

.product-edit__candidates {
  display: grid;
  gap: 10px;
}

/* 비활성화는 파괴적 동작이라 푸터 왼쪽 끝에 따로 둡니다. */
.product-edit__deactivate {
  margin-right: auto;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-danger-text);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.product-edit__deactivate:hover {
  text-decoration: underline;
}

@media (prefers-reduced-motion: reduce) {
  .product-edit__image {
    transition: none;
  }
}
</style>
