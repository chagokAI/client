<script setup>
defineProps({ value: { type: String, required: true } })
</script>

<template>
  <span class="flip-digit">
    <span class="flip-digit__spacer">{{ value }}</span>
    <Transition name="digit-flip" appear>
      <span :key="value" class="flip-digit__glyph">{{ value }}</span>
    </Transition>
  </span>
</template>

<style scoped>
.flip-digit {
  display: inline-grid;
  position: relative;
  perspective: 4em;
  vertical-align: baseline;
}

.flip-digit__spacer,
.flip-digit__glyph {
  grid-area: 1 / 1;
}

.flip-digit__spacer {
  visibility: hidden;
}

.flip-digit__glyph {
  backface-visibility: hidden;
  transform-origin: 50% 60%;
}

.digit-flip-enter-active {
  transition:
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 220ms ease;
}

.digit-flip-leave-active {
  transition:
    transform 150ms ease-in,
    opacity 120ms ease-in;
}

.digit-flip-enter-from {
  opacity: 0;
  transform: translateY(0.25em) rotateX(80deg);
}

.digit-flip-leave-to {
  opacity: 0;
  transform: translateY(-0.2em) rotateX(-80deg);
}

@media (prefers-reduced-motion: reduce) {
  .digit-flip-enter-active,
  .digit-flip-leave-active {
    transition: none;
  }

  .digit-flip-enter-from,
  .digit-flip-leave-to {
    opacity: 1;
    transform: none;
  }
}
</style>
