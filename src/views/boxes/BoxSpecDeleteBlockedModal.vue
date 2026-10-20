<script setup>
import { computed } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import SummaryBox from '@/components/common/SummaryBox.vue'

const props = defineProps({
  spec: {
    type: Object,
    required: true,
  },
  // 이 규격을 쓰고 있는 진행 중 발주서 번호. 없으면 표시하지 않습니다.
  openOrderNumber: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['close', 'view-products'])

const summary = computed(() => {
  const items = [{ id: 'linked', label: '연결 상품', value: `${props.spec.linkedProducts}개` }]
  if (props.openOrderNumber) {
    items.push({ id: 'order', label: '진행 중 발주', value: props.openOrderNumber })
  }
  return items
})
</script>

<template>
  <BaseModal compact width="520px" @close="emit('close')">
    <span class="blocked__icon" aria-hidden="true">!</span>

    <h2 class="blocked__title">사용 중인 규격은 삭제할 수 없어요</h2>
    <p class="blocked__description">
      {{ spec.code }} {{ spec.sizeName }}에 연결된 상품과 진행 중인 발주가 있어요.<br />
      연결을 해제하고 미사용으로 바꾼 뒤 삭제해 주세요.
    </p>

    <SummaryBox class="blocked__summary" :items="summary" />

    <template #footer>
      <AppButton size="lg" @click="emit('close')">닫기</AppButton>
      <AppButton size="lg" variant="primary" @click="emit('view-products')">연결 상품 보기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.blocked__icon {
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

.blocked__title {
  margin: 18px 0 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: -0.4px;
  word-break: keep-all;
}

.blocked__description {
  margin: 12px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}

.blocked__summary {
  margin-top: 20px;
}
</style>
