<script setup>
defineProps({
  // { to, label } 형태의 배열. to는 라우터 경로입니다.
  tabs: {
    type: Array,
    required: true,
  },
  ariaLabel: {
    type: String,
    default: '하위 메뉴',
  },
})
</script>

<template>
  <nav class="tab-nav" :aria-label="ariaLabel">
    <RouterLink v-for="tab in tabs" :key="tab.to" class="tab-nav__tab" :to="tab.to">
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.tab-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--color-card-border);
}

.tab-nav__tab {
  position: relative;
  padding: 10px 14px 12px;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  text-decoration: none;
  white-space: nowrap;
  transition: color 160ms ease;
}

.tab-nav__tab:hover {
  color: var(--color-text-secondary);
}

.tab-nav__tab.router-link-active {
  color: var(--color-text);
  font-weight: 700;
}

.tab-nav__tab.router-link-active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--color-brown);
}

@media (prefers-reduced-motion: reduce) {
  .tab-nav__tab {
    transition: none;
  }
}
</style>
