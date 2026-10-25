<script setup>
import ConfirmDeleteModal from '@/components/common/ConfirmDeleteModal.vue'

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
  <ConfirmDeleteModal
    :title="`${spec.code} ${spec.sizeName} 규격을 삭제할까요?`"
    :items="summary"
    @close="emit('close')"
    @confirm="emit('confirm')"
  >
    <template #description>
      삭제한 규격은 되돌릴 수 없어요.<br />
      미사용 규격이라 연결된 상품과 재고 기준에는 영향이 없어요.
    </template>
  </ConfirmDeleteModal>
</template>
