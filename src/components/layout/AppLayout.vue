<script setup>
import AppHeader from './AppHeader.vue'
</script>

<template>
  <div class="app-layout">
    <AppHeader />

    <main class="app-layout__main">
      <div class="app-layout__content">
        <slot />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  background: var(--color-white);
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
</style>
