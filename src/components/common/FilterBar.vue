<script setup>
// 목록 화면 공통 필터 줄. 기본 슬롯은 왼쪽(검색·칩), aside 슬롯은 오른쪽 끝 보조 문구입니다.
// second 슬롯을 쓰면 아랫줄이 하나 더 생깁니다. (예: 윗줄 기간·검색·정렬, 아랫줄 상태 칩)
</script>

<template>
  <div class="filter-bar">
    <div class="filter-bar__row">
      <slot />
      <span v-if="$slots.aside" class="filter-bar__aside"><slot name="aside" /></span>
    </div>

    <div v-if="$slots.second" class="filter-bar__row">
      <slot name="second" />
    </div>
  </div>
</template>

<style scoped>
/* 요약 카드·표와 붙어 보이지 않도록 위아래로 넉넉히 띄웁니다. */
.filter-bar {
  display: grid;
  gap: 14px;
  margin: 28px 0;
}

.filter-bar__row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.filter-bar__aside {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
}
</style>
