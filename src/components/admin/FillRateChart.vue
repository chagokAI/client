<script setup>
import { computed } from 'vue'

// 월별 충진율 막대. 한 막대를 기본 7종 충진율 · 지난달까지 오른 몫 · 이번 달 오른 몫으로 쌓고,
// 목표선(점선)을 함께 그어 목표까지 얼마나 남았는지 보여 줍니다.
const props = defineProps({
  // 기본 7종만 쓸 때 충진율(%)
  base: { type: Number, required: true },
  // 월별 충진율(%). months 와 같은 순서
  fills: { type: Array, required: true },
  months: { type: Array, required: true },
  target: { type: Number, default: 50 },
})

const W = 300
const TOP = 16
const BOTTOM = 100
const BAR = 44

const max = computed(() => Math.max(70, Math.ceil((Math.max(...props.fills, props.target) + 10) / 10) * 10))
const y = (v) => BOTTOM - (v / max.value) * (BOTTOM - TOP)

const bars = computed(() =>
  props.fills.map((fill, i) => {
    const prev = i ? Math.max(props.fills[i - 1], props.base) : props.base
    const x = ((i + 0.5) * W) / props.fills.length - BAR / 2
    const seg = (from, to, kind) => ({ kind, y: y(to), height: Math.max(0, y(from) - y(to)) })
    return {
      x,
      fill,
      month: props.months[i],
      segments: [seg(0, props.base, 'base'), seg(props.base, prev, 'prior'), seg(prev, fill, 'now')],
    }
  }),
)
</script>

<template>
  <figure class="fill-chart">
    <svg :viewBox="`0 0 ${W} 120`" role="img" :aria-label="`월별 충진율: ${fills.join('%, ')}%`">
      <g v-for="bar in bars" :key="bar.month">
        <rect
          v-for="s in bar.segments"
          :key="s.kind"
          :class="`fill-chart__${s.kind}`"
          :x="bar.x"
          :y="s.y"
          :width="BAR"
          :height="s.height"
        />
        <text class="fill-chart__value" :x="bar.x + BAR / 2" :y="y(bar.fill) - 4">{{ bar.fill.toFixed(1) }}%</text>
        <text class="fill-chart__month" :x="bar.x + BAR / 2" y="114">{{ bar.month }}</text>
      </g>
      <line class="fill-chart__target" x1="0" :x2="W" :y1="y(target)" :y2="y(target)" />
    </svg>
    <figcaption class="fill-chart__legend">
      <span><i class="fill-chart__base" />기본 7종</span>
      <span><i class="fill-chart__prior" />지난달까지 상승</span>
      <span><i class="fill-chart__now" />이번 달 상승</span>
      <span><i class="fill-chart__target-key" />목표 {{ target }}%</span>
    </figcaption>
  </figure>
</template>

<style scoped>
.fill-chart {
  margin: 0;
}

svg {
  display: block;
  width: 100%;
  height: auto;
}

.fill-chart__base {
  fill: var(--color-card-border);
  background: var(--color-card-border);
}

.fill-chart__prior {
  fill: var(--color-brown);
  background: var(--color-brown);
}

.fill-chart__now {
  fill: var(--color-gold);
  background: var(--color-gold);
}

.fill-chart__target {
  stroke: var(--color-navy);
  stroke-width: 1;
  stroke-dasharray: 4 3;
}

.fill-chart__value {
  fill: var(--color-text);
  font-size: 10px;
  font-weight: 700;
  text-anchor: middle;
}

.fill-chart__month {
  fill: var(--color-text-muted);
  font-size: 10px;
  text-anchor: middle;
}

.fill-chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 8px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.fill-chart__legend span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.fill-chart__legend i {
  display: inline-block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
}

.fill-chart__legend .fill-chart__target-key {
  width: 14px;
  height: 0;
  border-top: 1px dashed var(--color-navy);
  border-radius: 0;
}
</style>
