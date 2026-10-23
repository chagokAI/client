<script setup>
// 목록 화면 공통 필터 줄. 기본 슬롯은 왼쪽(검색·칩), aside 슬롯은 오른쪽 끝 보조 문구입니다.
// second 슬롯을 쓰면 아랫줄이 하나 더 생기고, aside 는 그 아랫줄 오른쪽 끝으로 내려갑니다.
// (예: 윗줄 기간·검색·정렬, 아랫줄 상태 칩 + 보조 문구)
</script>

<template>
  <div class="filter-bar">
    <div class="filter-bar__row">
      <slot />
      <span v-if="$slots.aside && !$slots.second" class="filter-bar__aside"><slot name="aside" /></span>
    </div>

    <div v-if="$slots.second" class="filter-bar__row">
      <slot name="second" />
      <span v-if="$slots.aside" class="filter-bar__aside"><slot name="aside" /></span>
    </div>
  </div>
</template>

<style scoped>
/* 위로는 요약 카드와 넉넉히 떼고, 아래 표와는 가깝게 붙여 한 덩어리로 읽히게 합니다. */
.filter-bar {
  display: grid;
  gap: 14px;
  margin: 28px 0 14px;
}

.filter-bar__row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* 아랫줄(상태 칩)은 높이가 제각각인 요소가 섞이므로 바닥선에 맞춥니다. */
.filter-bar__row + .filter-bar__row {
  align-items: flex-end;
}

.filter-bar__aside {
  margin-left: auto;
  color: var(--color-text-muted);
  font-size: 12px;
  white-space: nowrap;
}
</style>
