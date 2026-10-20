<script setup>
import { computed } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import SummaryBox from '@/components/common/SummaryBox.vue'

// 이 모달은 전달받은 디자인에 없어, 박스 규격 삭제 모달(06-2)과 같은 구성으로 맞췄습니다.
const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'confirm'])

const summary = computed(() => [
  { id: 'product', label: '상품', value: `${props.product.name} · ${props.product.code}` },
  { id: 'category', label: '카테고리', value: props.product.category },
  { id: 'size', label: '상품 사이즈', value: props.product.size },
  { id: 'matched', label: '매칭 상자', value: props.product.matchedBox ?? '—' },
])
</script>

<template>
  <BaseModal compact width="440px" @close="emit('close')">
    <span class="product-delete__icon" aria-hidden="true">!</span>

    <h2 class="product-delete__title">{{ product.name }} 상품을 삭제할까요?</h2>
    <p class="product-delete__description">
      삭제한 상품은 되돌릴 수 없어요.<br />
      매칭 결과와 포장 이력도 함께 사라져요.
    </p>

    <SummaryBox class="product-delete__summary" :items="summary" />

    <template #footer>
      <AppButton size="lg" @click="emit('close')">취소</AppButton>
      <AppButton size="lg" variant="danger" @click="emit('confirm')">삭제하기</AppButton>
    </template>
  </BaseModal>
</template>

<style scoped>
.product-delete__icon {
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

.product-delete__title {
  margin: 18px 0 0;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.45;
  letter-spacing: -0.4px;
  word-break: keep-all;
}

.product-delete__description {
  margin: 10px 0 0;
  color: var(--color-text-secondary);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}

.product-delete__summary {
  margin-top: 20px;
}
</style>
