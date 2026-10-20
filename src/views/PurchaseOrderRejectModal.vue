<script setup>
import { computed, reactive } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import FilterChips from '@/components/common/FilterChips.vue'
import FormField from '@/components/common/FormField.vue'
import InlineNotice from '@/components/common/InlineNotice.vue'
import { rejectReasons } from '@/mocks/orders'

const props = defineProps({
  // { number, supplier, quantity, amount, requester } 형태
  order: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])

const MAX_LENGTH = 500

const form = reactive({
  reason: rejectReasons[0].value,
  detail: '',
})

const description = computed(() =>
  [props.order.number, props.order.supplier, props.order.quantity, props.order.amount].join(' · '),
)

const canSubmit = computed(() => form.reason && form.detail.trim().length > 0)

function handleConfirm() {
  if (!canSubmit.value) return
  // TODO: 발주서 반려 API에 연결합니다.
  emit('confirm', { ...form })
}
</script>

<template>
  <BaseModal title="발주서 반려" :description="description" width="620px" @close="emit('close')">
    <form class="reject" novalidate @submit.prevent="handleConfirm">
      <FormField label="반려 사유" required>
        <FilterChips v-model="form.reason" :options="rejectReasons" aria-label="반려 사유" />
      </FormField>

      <FormField label="상세 내용" required>
        <template #default="{ fieldId }">
          <textarea
            :id="fieldId"
            v-model="form.detail"
            class="reject__textarea"
            rows="4"
            :maxlength="MAX_LENGTH"
            placeholder="반려 사유를 구체적으로 적어주세요"
          />
        </template>

        <template #hint>
          <span class="reject__counter">{{ form.detail.length }} / {{ MAX_LENGTH }}</span>
        </template>
      </FormField>

      <InlineNotice>
        반려하면 요청자({{ order.requester }})에게 알림이 가고, 발주서는 <strong>임시저장</strong> 상태로 돌아가 수정할 수
        있어요.
      </InlineNotice>
    </form>

    <template #footer>
      <AppButton @click="emit('close')">취소</AppButton>
      <AppButton variant="danger" :disabled="!canSubmit" @click="handleConfirm">반려하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.reject {
  display: grid;
  gap: 18px;
}

.reject__textarea {
  width: 100%;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-white);
  color: var(--color-text);
  font-size: 13px;
  line-height: 1.6;
  resize: vertical;
  transition: border-color 160ms ease, box-shadow 160ms ease;
}

.reject__textarea::placeholder {
  color: var(--color-text-muted);
  opacity: 1;
}

.reject__textarea:focus {
  border-color: var(--color-brown);
  outline: none;
  box-shadow: 0 0 0 3px rgb(102 64 34 / 12%);
}

.reject__counter {
  display: block;
  text-align: right;
}

@media (prefers-reduced-motion: reduce) {
  .reject__textarea {
    transition: none;
  }
}
</style>
