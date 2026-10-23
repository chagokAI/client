<script setup>
import { reactive } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FormField from '@/components/common/FormField.vue'
import InlineNotice from '@/components/common/InlineNotice.vue'
import OptionCard from '@/components/common/OptionCard.vue'
import SelectField from '@/components/common/SelectField.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TextInput from '@/components/common/TextInput.vue'
import { fillTone } from '@/api/format'

const props = defineProps({
  categories: { type: Array, default: () => [] },
  busy: Boolean,
  product: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'save', 'deactivate'])

// 매칭 상자는 고르지 않고, 추천된 상자 한 개만 보여 줍니다.
const recommendation = (props.product.matchCandidates ?? [])
  .filter((c) => c.recommended)
  .map((c) => ({
    id: c.boxSpec.id,
    label: `${c.boxSpec.code} · ${c.boxSpec.name}`,
    dimensions: `${c.boxSpec.innerWidthMm} × ${c.boxSpec.innerDepthMm} × ${c.boxSpec.innerHeightMm} mm`,
    fillRate: c.fillRatePct,
  }))[0]
const categoryOptions = props.categories

const form = reactive({
  name: props.product.name,
  category: props.product.categoryId ?? '',
  weight: props.product.weightG ?? '',
  width: props.product.widthMm ?? '',
  depth: props.product.depthMm ?? '',
  height: props.product.heightMm ?? '',
  matchedBoxId: recommendation?.id ?? props.product.matchedBoxSpec?.id ?? '',
})

function handleSave() {
  if (props.busy) return
  emit('save', { ...form })
}
</script>

<template>
  <BaseModal title="상품 수정" :description="`${product.name} · ${product.code}`" width="760px" @close="emit('close')">
    <template #title-badge>
      <StatusBadge :label="product.statusLabel" />
    </template>

    <form class="product-edit" novalidate @submit.prevent="handleSave">
      <div class="product-edit__identity-fields">
        <FormField v-slot="{ fieldId }" label="상품명" required>
          <TextInput :id="fieldId" v-model="form.name" aria-label="상품명" />
        </FormField>

        <FormField v-slot="{ fieldId }" label="상품코드">
          <TextInput :id="fieldId" :model-value="product.code" readonly aria-label="상품코드" />
        </FormField>

        <FormField v-slot="{ fieldId }" label="카테고리" required>
          <SelectField
            :id="fieldId"
            v-model="form.category"
            :options="categoryOptions"
            width="100%"
            aria-label="카테고리"
          />
        </FormField>

        <FormField v-slot="{ fieldId }" label="무게">
          <TextInput :id="fieldId" v-model="form.weight" suffix="g" format-number aria-label="무게" />
        </FormField>
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

      <section v-if="recommendation" class="product-edit__matching">
        <header class="product-edit__matching-head">
          <h3 class="product-edit__matching-title">매칭 택배 상자</h3>
        </header>

        <OptionCard
          readonly
          name="matched-box"
          :value="recommendation.id"
          :model-value="recommendation.id"
          :title="recommendation.label"
          :subtitle="recommendation.dimensions"
          badge="치수 추천"
          badge-tone="gold"
          :rate="recommendation.fillRate"
          :rate-tone="fillTone(recommendation.fillRate)"
        />
      </section>

      <InlineNotice>저장하면 치수에 맞춰 적합 여부와 포장공간비율을 다시 계산해요.</InlineNotice>
    </form>

    <template #footer>
      <button class="product-edit__deactivate" type="button" @click="emit('deactivate')">상품 비활성화</button>
      <AppButton @click="emit('close')">취소</AppButton>
      <AppButton variant="primary" :disabled="busy" @click="handleSave">저장하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.product-edit {
  display: grid;
  gap: 18px;
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
</style>
