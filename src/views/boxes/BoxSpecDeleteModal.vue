<script setup>
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'

const props = defineProps({
  spec: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])

const summary = [
  { id: 'spec', label: '규격', value: `${props.spec.code} · ${props.spec.sizeName}` },
  { id: 'dimensions', label: '내경 사이즈', value: props.spec.dimensions },
  { id: 'supplier', label: '공급사', value: props.spec.supplier },
  { id: 'linked', label: '연결 상품', value: `${props.spec.linkedProducts}개` },
]
</script>

<template>
  <BaseModal compact width="440px" @close="emit('close')">
    <span class="delete-modal__icon" aria-hidden="true">!</span>

    <h2 class="delete-modal__title">{{ spec.code }} {{ spec.sizeName }} 규격을 삭제할까요?</h2>
    <p class="delete-modal__description">
      삭제한 규격은 되돌릴 수 없어요.<br />
      미사용 규격이라 연결된 상품과 재고 기준에는 영향이 없어요.
    </p>

    <dl class="delete-modal__summary">
      <div v-for="item in summary" :key="item.id" class="delete-modal__summary-row">
        <dt>{{ item.label }}</dt>
        <dd>{{ item.value }}</dd>
      </div>
    </dl>

    <template #footer>
      <AppButton size="lg" @click="emit('close')">취소</AppButton>
      <AppButton size="lg" variant="danger" @click="emit('confirm')">삭제하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.delete-modal__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-danger-bg);
  color: var(--color-danger);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.delete-modal__title {
  margin: 18px 0 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: -0.4px;
  word-break: keep-all;
}

.delete-modal__description {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}

.delete-modal__summary {
  margin: 20px 0 0;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: #f7f8f9;
  text-align: left;
}

.delete-modal__summary-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.delete-modal__summary-row + .delete-modal__summary-row {
  margin-top: 7px;
}

.delete-modal__summary dt {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.delete-modal__summary dd {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}
</style>
