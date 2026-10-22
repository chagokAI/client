<script setup>
import AppSidebar from './AppSidebar.vue'
import { useSidebar } from '@/composables/useSidebar'

const { isCollapsed } = useSidebar()
</script>

<template>
  <div class="app-layout" :class="{ 'app-layout--collapsed': isCollapsed }">
    <AppSidebar />

    <div class="app-layout__body">
      <main class="app-layout__main">
        <div class="app-layout__content">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  min-height: 100svh;
  background: var(--color-white);
}

.app-layout__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  /* 드로어가 fixed이므로 본문을 폭만큼 밀어 둡니다. */
  margin-left: var(--sidebar-width);
  transition: margin-left 180ms ease;
}

.app-layout--collapsed .app-layout__body {
  margin-left: var(--sidebar-width-collapsed);
}

.app-layout__main {
  flex: 1;
  min-width: 0;
}

.app-layout__content {
  max-width: var(--layout-max-width);
  margin: 0 auto;
  padding: 40px var(--layout-gutter) 72px;
}

@media (max-width: 1100px) {
  .app-layout__content {
    padding: 32px 24px 56px;
  }
}

@media (max-width: 900px) {
  .app-layout__body,
  .app-layout--collapsed .app-layout__body {
    margin-left: 0;
  }

  /* 드로어를 여는 버튼이 본문 위에 떠 있으므로 위쪽을 비워 둡니다. */
  .app-layout__content {
    padding-top: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-layout__body {
    transition: none;
  }
}
</style>
