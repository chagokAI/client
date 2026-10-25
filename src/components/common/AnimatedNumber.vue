<script setup>
import { computed } from 'vue'
import FlipDigit from './FlipDigit.vue'

const props = defineProps({
  value: { type: [String, Number], default: '—' },
})

const text = computed(() => String(props.value ?? '—'))
// 오른쪽 자릿수를 기준으로 유지해 999 → 1,000에서도 기존 숫자가 자연스럽게 넘어갑니다.
const characters = computed(() =>
  Array.from(text.value, (value, index) => ({
    value,
    place: text.value.length - index - 1,
    digit: /^\d$/.test(value),
  })),
)
</script>

<template>
  <span class="animated-number">
    <span class="animated-number__accessible">{{ text }}</span>
    <span aria-hidden="true">
      <template v-for="character in characters" :key="character.place">
        <FlipDigit v-if="character.digit" :value="character.value" />
        <span v-else>{{ character.value }}</span>
      </template>
    </span>
  </span>
</template>

<style scoped>
.animated-number {
  display: inline-block;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* 보조 기술에는 애니메이션의 이전 숫자와 중복 없이 최신 값만 전달합니다. */
.animated-number__accessible {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  padding: 0;
  border: 0;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
