<script setup>
defineProps({ loading: Boolean, error: { type: String, default: '' } })
defineEmits(['retry'])
</script>

<template>
  <p v-if="error" class="api-state api-state--error" role="alert">
    {{ error }} <button type="button" @click="$emit('retry')">다시 시도</button>
  </p>
  <p v-else-if="loading" class="api-state" role="status">불러오는 중이에요.</p>
</template>

<style scoped>
.api-state { padding: 12px 16px; margin: 0 0 16px; border-radius: 8px; background: #f7f3ec; font-size: 13px; }
.api-state--error { background: #fff0ee; color: #a12f20; }
.api-state button { margin-left: 12px; background: transparent; border: 0; color: inherit; text-decoration: underline; cursor: pointer; }
</style>
