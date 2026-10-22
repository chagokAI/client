<script setup>
// 목록 화면 공통 필터 줄. 기본 슬롯은 왼쪽(검색·칩), aside 슬롯은 오른쪽 끝 보조 문구입니다.
</script>

<template>
  <div class="filter-bar">
    <slot />
    <span v-if="$slots.aside" class="filter-bar__aside"><slot name="aside" /></span>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.filter-bar__aside {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
}
</style>
