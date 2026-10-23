<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import AppButton from '@/components/common/AppButton.vue'
import DigitalTwinViewer from './DigitalTwinViewer.vue'

// 실시간 센터 현황(디지털트윈) 미리보기. 전체 화면을 누르면 같은 인스턴스를 body로 옮겨 화면 가운데에 크게 띄웁니다.
// 3D 장면을 다시 만들지 않도록 Teleport로 위치만 바꾸고, 미리보기 자리와 가운데 사이를 FLIP 애니메이션으로 오갑니다.
const expanded = ref(false)
const overlay = useTemplateRef('overlay')
const frame = useTemplateRef('frame')
const placeholder = useTemplateRef('placeholder')
let animating = false

const MOTION = { duration: 320, easing: 'cubic-bezier(0.2, 0, 0, 1)' }

function animate(from, to, reverse) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  const small = from.width < to.width ? from : to
  const large = from.width < to.width ? to : from
  const shrunk = `translate(${small.left - large.left}px, ${small.top - large.top}px) scale(${small.width / large.width}, ${small.height / large.height})`
  const frames = [
    { transformOrigin: 'top left', transform: shrunk },
    { transformOrigin: 'top left', transform: 'none' },
  ]
  const backdrop = [{ opacity: 0 }, { opacity: 1 }]
  overlay.value?.animate(reverse ? backdrop.reverse() : backdrop, { ...MOTION, fill: 'forwards' })
  return frame.value?.animate(reverse ? frames.reverse() : frames, { ...MOTION, fill: 'forwards' })
}

function clearAnimations() {
  frame.value?.getAnimations().forEach((animation) => animation.cancel())
  overlay.value?.getAnimations().forEach((animation) => animation.cancel())
}

async function open() {
  if (expanded.value || animating) return
  animating = true
  const from = frame.value.getBoundingClientRect()
  expanded.value = true
  await nextTick()
  await animate(from, frame.value.getBoundingClientRect(), false)?.finished
  clearAnimations()
  animating = false
}

async function close() {
  if (!expanded.value || animating) return
  animating = true
  await animate(frame.value.getBoundingClientRect(), placeholder.value.getBoundingClientRect(), true)?.finished
  expanded.value = false
  await nextTick()
  clearAnimations()
  animating = false
}

// 재생/정지: 시뮬레이션 코드는 그대로 두고, 시뮬레이션 안에 있는 '재생' 버튼(#play)을 대신 눌러 줍니다.
// 아직 불러온 구간이 없으면(#play 비활성) 기본 구간을 먼저 불러오고(#load), 불러오기가 끝나면 이어서 재생합니다.
const playing = ref(false)
const preparing = ref(false)
let twinPlay = null
let twinStatus = null
let observer = null

function syncPlayState() {
  playing.value = twinPlay?.textContent.includes('일시정지') ?? false
  if (!preparing.value || !twinPlay) return
  if (!twinPlay.disabled) {
    preparing.value = false
    twinPlay.click()
  } else if (twinStatus && !twinStatus.textContent.includes('불러오는 중')) {
    // 불러오기가 끝났는데도 재생할 건이 없으면 기다리지 않습니다.
    preparing.value = false
  }
}

function togglePlay() {
  if (!twinPlay || preparing.value) return
  if (!twinPlay.disabled) return twinPlay.click()
  preparing.value = true
  frame.value?.querySelector('#load')?.click()
}

onMounted(() => {
  twinPlay = frame.value?.querySelector('#play') ?? null
  twinStatus = frame.value?.querySelector('#status') ?? null
  observer = new MutationObserver(syncPlayState)
  for (const el of [twinPlay, twinStatus]) {
    if (el) observer.observe(el, { attributes: true, childList: true, characterData: true, subtree: true })
  }
  syncPlayState()
})

function handleKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(expanded, (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
  if (value) document.addEventListener('keydown', handleKeydown)
  else document.removeEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  document.body.style.overflow = ''
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="live">
    <div class="live__head">
      <div class="live__title-row">
        <h2 class="live__title">실시간 센터 현황</h2>
        <span class="live__badge"><span class="live__dot" />LIVE</span>
      </div>
      <div class="live__actions">
        <AppButton
          class="live__icon-button"
          size="sm"
          :disabled="preparing"
          :aria-label="preparing ? '구간 불러오는 중' : playing ? '시뮬레이션 정지' : '시뮬레이션 재생'"
          :aria-pressed="playing"
          :title="preparing ? '구간 불러오는 중' : playing ? '정지' : '재생'"
          @click="togglePlay"
        >
          <svg v-if="playing" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M5.5 3.5v9M10.5 3.5v9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
          <svg v-else viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M5 3.2v9.6a.5.5 0 0 0 .76.43l7.6-4.8a.5.5 0 0 0 0-.86l-7.6-4.8A.5.5 0 0 0 5 3.2Z"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linejoin="round"
            />
          </svg>
        </AppButton>
        <AppButton class="live__icon-button" size="sm" aria-label="전체 화면" title="전체 화면" @click="open">
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 6V2h4M2 2l4.5 4.5M10 2h4v4M14 2 9.5 6.5M2 10v4h4M2 14l4.5-4.5M14 10v4h-4M14 14 9.5 9.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </AppButton>
      </div>
    </div>

    <!-- 크게 연 동안 미리보기 자리를 비워 두어 카드 높이가 바뀌지 않게 하고, 닫을 때 돌아갈 위치로 씁니다. -->
    <div v-if="expanded" ref="placeholder" class="live__placeholder" />

    <Teleport to="body" :disabled="!expanded">
      <div ref="overlay" :class="expanded ? 'live-overlay' : 'live-preview'" @click.self="close">
        <div ref="frame" class="live__frame">
          <div v-if="expanded" class="live__frame-head">
            <div class="live__title-row">
              <h2 class="live__title">실시간 센터 현황</h2>
              <span class="live__badge"><span class="live__dot" />LIVE</span>
            </div>
            <AppButton size="sm" @click="close">닫기</AppButton>
          </div>
          <DigitalTwinViewer />
          <button
            v-if="!expanded"
            class="live__open"
            type="button"
            aria-label="실시간 센터 현황 크게 보기"
            @click="open"
          />
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.live {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.live__head,
.live__frame-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.live__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.live__title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.4;
  letter-spacing: -0.3px;
}

.live__badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 20px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--color-navy);
  color: var(--color-white);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.live__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff4d4f;
}

.live__actions {
  display: flex;
  gap: 6px;
}

.live__icon-button {
  width: 30px;
  padding: 0;
}

.live__icon-button svg {
  width: 15px;
  height: 15px;
}

.live__frame {
  position: relative;
}

.live__placeholder {
  flex: 1;
  min-height: 180px;
  border-radius: 14px;
  background: var(--color-cream);
}

/* 미리보기: 3D 장면만 작게 보여 주고, 누르면 크게 엽니다. */
.live-preview,
.live-preview .live__frame {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.live-preview :deep(.twin) {
  /* 도구 막대·하단 통계를 숨기므로 3D 영역 한 줄만 남깁니다. */
  flex: 1;
  grid-template-rows: minmax(0, 1fr);
  height: auto;
  min-height: 180px;
  pointer-events: none;
}

.live-preview :deep(.twin .bar),
.live-preview :deep(.twin .foot),
.live-preview :deep(.twin .hint-chip),
.live-preview :deep(.twin .legend) {
  display: none;
}

.live__open {
  position: absolute;
  inset: 0;
  border: 0;
  border-radius: 14px;
  background: transparent;
  cursor: zoom-in;
}

/* 전체 화면: 화면 가운데에 크게 띄웁니다. */
.live-overlay {
  position: fixed;
  inset: 0;
  z-index: 110;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(10 18 32 / 60%);
}

.live-overlay .live__frame {
  width: min(1440px, 100%);
  padding: 16px 20px 20px;
  border-radius: var(--radius-lg);
  background: var(--color-white);
  box-shadow: var(--shadow-modal);
}

.live-overlay :deep(.twin) {
  height: min(820px, calc(100vh - 120px));
  height: min(820px, calc(100svh - 120px));
}
</style>
