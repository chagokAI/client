<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from './components/layout/AppLayout.vue'

const route = useRoute()

// 로그인처럼 헤더가 없는 화면은 레이아웃 없이 그대로 렌더링합니다.
const useBlankLayout = computed(() => route.meta.layout === 'blank')
</script>

<template>
  <RouterView v-if="useBlankLayout" />

  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>
