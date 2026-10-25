<script setup>
import { computed } from 'vue'
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal.vue'

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
  <ConfirmDeleteModal
    :title="`${product.name} 상품을 삭제할까요?`"
    :items="summary"
    @close="emit('close')"
    @confirm="emit('confirm')"
  >
    <template #description>
      삭제한 상품은 되돌릴 수 없어요.<br />
      매칭 결과와 포장 이력도 함께 사라져요.
    </template>
  </ConfirmDeleteModal>
</template>
