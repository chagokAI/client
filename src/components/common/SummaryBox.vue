<script setup>
defineProps({
  // { id, label, value } 배열. 라벨은 왼쪽, 값은 오른쪽에 정렬됩니다.
  items: {
    type: Array,
    required: true,
  },
})
</script>

<template>
  <dl class="summary-box">
    <div v-for="item in items" :key="item.id" class="summary-box__row">
      <dt>{{ item.label }}</dt>
      <dd>{{ item.value }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.summary-box {
  margin: 0;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  background: #f7f8f9;
  text-align: left;
}

.summary-box__row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.summary-box__row + .summary-box__row {
  margin-top: 7px;
}

.summary-box dt {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.summary-box dd {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  text-align: right;
}
</style>
