<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from './components/layout/AppLayout.vue'
import { auth } from '@/stores/auth'
import { resetLiveInput } from '@/stores/liveInput'

const route = useRoute()

// 로그인처럼 헤더가 없는 화면은 레이아웃 없이 그대로 렌더링합니다.
const useBlankLayout = computed(() => route.meta.layout === 'blank')

watch(() => `${auth.session.value?.id}:${auth.warehouseId.value}`, resetLiveInput, { flush: 'sync' })
onBeforeUnmount(resetLiveInput)
</script>

<template>
  <RouterView v-if="useBlankLayout" />

  <AppLayout v-else>
    <RouterView />
  </AppLayout>
</template>
