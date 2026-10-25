<script setup>
import AppButton from './AppButton.vue'
import BaseModal from './BaseModal.vue'
import SummaryBox from './SummaryBox.vue'

// 삭제 확인 모달의 공통 틀. 무엇을 지우는지(title)와 되돌릴 수 없다는 안내(description),
// 지울 대상의 요약(items)만 화면마다 다릅니다.
defineProps({
  title: {
    type: String,
    required: true,
  },
  // 줄바꿈이 필요하면 description 슬롯을 대신 씁니다.
  description: {
    type: String,
    default: '',
  },
  // SummaryBox 에 그대로 넘기는 { id, label, value } 배열
  items: {
    type: Array,
    default: () => [],
  },
  confirmLabel: {
    type: String,
    default: '삭제하기',
  },
})

const emit = defineEmits(['close', 'confirm'])
</script>

<template>
  <BaseModal compact width="440px" @close="emit('close')">
    <span class="confirm-delete__icon" aria-hidden="true">!</span>

    <h2 class="confirm-delete__title">{{ title }}</h2>
    <p class="confirm-delete__description">
      <slot name="description">{{ description }}</slot>
    </p>

    <SummaryBox v-if="items.length" class="confirm-delete__summary" :items="items" />

    <template #footer>
      <AppButton size="lg" @click="emit('close')">취소</AppButton>
      <AppButton size="lg" variant="danger" @click="emit('confirm')">{{ confirmLabel }}</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.confirm-delete__icon {
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

.confirm-delete__title {
  margin: 18px 0 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: -0.4px;
  word-break: keep-all;
}

.confirm-delete__description {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}

.confirm-delete__summary {
  margin-top: 20px;
}
</style>
