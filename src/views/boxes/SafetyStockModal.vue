<script setup>
import { computed, reactive } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FormField from '@/components/common/FormField.vue'
import InlineNotice from '@/components/common/InlineNotice.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import TextInput from '@/components/common/TextInput.vue'
import ToggleSwitch from '@/components/common/ToggleSwitch.vue'

const props = defineProps({
  spec: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'save'])

const form = reactive({
  safetyDays: props.spec.safetyDays,
  alertEnabled: props.spec.alertEnabled,
})

// 안전 재고 수량은 '일 평균 소모량 × 기준 일수'로 자동 계산되는 읽기 전용 값입니다.
const safetyQuantity = computed(() => props.spec.dailyUsage * Number(form.safetyDays || 0))

function handleSave() {
  // TODO: 안전 재고 기준 저장 API에 연결합니다.
  emit('save', { ...form, safetyQuantity: safetyQuantity.value })
}
</script>

<template>
  <BaseModal
    title="안전 재고 수정"
    :description="`${spec.code} · ${spec.sizeName} · 현재 재고 ${spec.current}`"
    width="620px"
    @close="emit('close')"
  >
    <template #title-badge>
      <StatusBadge :label="spec.status" />
    </template>

    <form class="safety-stock" novalidate @submit.prevent="handleSave">
      <div class="safety-stock__row">
        <FormField
          v-slot="{ fieldId }"
          label="안전 재고 기준"
          required
          hint="일 평균 소모량 기준으로 자동 계산"
        >
          <TextInput :id="fieldId" v-model="form.safetyDays" suffix="일분" format-number aria-label="안전 재고 기준 일수" />
        </FormField>

        <FormField
          v-slot="{ fieldId }"
          label="안전 재고 수량"
          :hint="`일 평균 ${spec.dailyUsage}개 × ${form.safetyDays || 0}일`"
        >
          <TextInput :id="fieldId" :model-value="safetyQuantity" suffix="개" format-number readonly aria-label="안전 재고 수량" />
        </FormField>
      </div>

      <FormField v-slot="{ fieldId }" label="공급사 리드타임">
        <TextInput
          :id="fieldId"
          :model-value="`${spec.leadTimeDays}일 · ${spec.supplier}`"
          suffix="공급사 정보"
          readonly
          aria-label="공급사 리드타임"
        />
      </FormField>

      <div class="safety-stock__alert">
        <div class="safety-stock__alert-text">
          <p class="safety-stock__alert-label">안전 재고 미만 알림</p>
          <p class="safety-stock__alert-hint">재고가 기준보다 떨어지면 알림을 보내요</p>
        </div>
        <ToggleSwitch v-model="form.alertEnabled" aria-label="안전 재고 미만 알림" />
      </div>

      <InlineNotice>기준을 바꾸면 박스 주문 제안서의 제안 수량이 다음 생성 때부터 반영돼요.</InlineNotice>
    </form>

    <template #footer>
      <AppButton @click="emit('close')">취소</AppButton>
      <AppButton variant="primary" @click="handleSave">저장하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.safety-stock {
  display: grid;
  gap: 16px;
}

.safety-stock__row {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.safety-stock__alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.safety-stock__alert-label {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 1.45;
}

.safety-stock__alert-hint {
  margin: 3px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.45;
}
</style>
