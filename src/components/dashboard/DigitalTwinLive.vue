<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { World } from '@/digital-twin/scene.js'
import { apiUrl } from '@/api/client.js'
import { auth } from '@/stores/auth.js'
import { warehouseApi } from '@/stores/auth.js'
import { createLiveSubscription, mergeStockBoxes } from '@/live/stream.js'
import { createLiveTruckFlow } from '@/live/trucks.js'
import { TRUCK_MM } from '@/digital-twin/packing.js'
import { createLiveInputControl } from '@/live/input.js'

const emit = defineEmits(['leave'])
const stage = ref(null)
const boxes = ref([])
const records = ref([])
const state = ref('paused')
const runPhase = ref('loading')
const runError = ref('')
const playing = computed(() => runPhase.value === 'running')
const controlBusy = computed(() => ['loading', 'starting', 'stopping', 'unavailable'].includes(runPhase.value))
const runLabels = {
  loading: '입력 상태 확인 중',
  starting: '시작 중',
  stopping: '정지 중 · 접수 작업 처리 중',
  paused: '일시정지',
  unavailable: '물류 입력기 사용 불가',
  error: '입력 상태 확인 필요',
}
const counts = ref({ packed: 0, waiting: 0, failed: 0 })
const labels = {
  paused: '일시정지',
  connecting: '연결 중',
  live: '연결됨',
  reconnecting: '재연결 중 · 기존 값 유지',
  error: '수신 오류 · 기존 값 유지',
}
const status = computed(() => (playing.value ? labels[state.value] : runLabels[runPhase.value]))
const playLabel = computed(() =>
  playing.value
    ? 'Ⅱ 일시정지'
    : runPhase.value === 'error'
      ? '상태 확인'
      : controlBusy.value
        ? runLabels[runPhase.value]
        : '▶ 재생',
)
let world
let stream
let flow
let frame
let input
const pending = ref(0)
const unplaced = ref(0)
const dims = (box) => [box.innerWidthMm, box.innerDepthMm, box.innerHeightMm]
const valid = (values) => values.every((value) => Number.isFinite(value) && value > 0)
const stock = (box) => (box.onHandQty == null ? '미입력' : box.onHandQty.toLocaleString('ko-KR'))

function resetScene() {
  // 장기 재생에서도 지난 트럭의 GPU 자원이 쌓이지 않도록 장면 이력을 비울 때 렌더러까지 정리한다.
  world?.dispose()
  world = new World(stage.value, { onSelect: showSelection })
  world.reset(TRUCK_MM, [
    boxes.value
      .filter((box) => valid(dims(box)))
      .map((box) => ({ code: box.code, dims: dims(box), stock: box.onHandQty })),
  ])
  flow = createLiveTruckFlow(world)
  pending.value = 0
}

function receive(name, item) {
  if (name === 'snapshot') {
    // 다시 연결한 현재고를 기준으로 장면을 시작한다. 놓친 포장 애니메이션은 만들어 내지 않는다.
    boxes.value = mergeStockBoxes(boxes.value, item.boxes).filter((box) =>
      item.boxes.some((next) => next.id === box.id),
    )
    resetScene()
    return
  }
  counts.value[name]++
  records.value.unshift({ ...item, kind: name })
  records.value = records.value.slice(0, 100)
  if (name !== 'packed' || !item.box) return
  boxes.value = mergeStockBoxes(boxes.value, [item.box])
  if (!flow.accept(item)) unplaced.value++
}

function animate(timestamp) {
  flow?.pump(timestamp, playing.value)
  pending.value = flow?.pending ?? 0
  frame = requestAnimationFrame(animate)
}

function toggle() {
  input?.toggle()
}
function leave() {
  input?.dispose()
}
function showSelection(selection) {
  if (selection?.type !== 'box') return
  const item = selection.event.serverItem
  if (item) selected.value = item
}
const selected = ref(null)
onMounted(() => {
  resetScene()
  animate()
  stream = createLiveSubscription(apiUrl(`/warehouses/${auth.warehouseId.value}/live-stream`), receive, {
    onState: (value) => {
      state.value = value
    },
  })
  // 구독은 관찰만 한다. 실제 신규 입력은 재생 버튼의 명시적인 PUT에서만 시작한다.
  stream.start()
  input = createLiveInputControl(
    async () => (await warehouseApi('/live-input')).data,
    async (running, { ownedOnly, controlId, ...options }) =>
      (await warehouseApi('/live-input', { method: 'PUT', body: { running, ownedOnly, controlId }, ...options })).data,
    (value) => {
      runPhase.value = value.phase
      runError.value = value.error
    },
  )
  input.load()
  window.addEventListener('pagehide', leave)
})
onBeforeUnmount(() => {
  window.removeEventListener('pagehide', leave)
  leave()
  cancelAnimationFrame(frame)
  stream?.stop()
  world?.dispose()
})
</script>

<template>
  <div class="twin twin-live">
    <header class="bar">
      <div class="tabs" role="tablist">
        <button data-tab="base" role="tab" @click="emit('leave', 'base')">시뮬레이션</button>
        <button data-tab="compare" role="tab" @click="emit('leave', 'compare')">비교 시뮬레이션</button>
        <button data-tab="live" class="on" role="tab" aria-selected="true">라이브</button>
      </div>
      <button id="livePlay" :aria-pressed="playing" :data-phase="runPhase" :disabled="controlBusy" @click="toggle">
        {{ playLabel }}
      </button>
      <span class="status" role="status">{{ status }}</span>
    </header>
    <p v-if="runError" role="alert">{{ runError }}</p>
    <main class="layout">
      <section class="stage">
        <div ref="stage" class="live-scene" />
        <p class="hint-chip">
          DL 측정 표본 재생 · 박스·재고는 서버 확정값 · 1톤 적재함 2,800×1,600×1,600mm와 박스 내경 기준 추정 배치
        </p>
        <div class="now">
          포장 {{ counts.packed }} · 재고 대기 {{ counts.waiting }} · 실패 {{ counts.failed }} · 적재 확인 필요
          {{ unplaced }} · 화면 대기 {{ pending }}
        </div>
        <aside v-if="selected" class="popup">
          <button @click="selected = null">닫기</button>
          <h3>{{ selected.product?.name }} · {{ selected.box?.code }}</h3>
          <p>서버 충전율 {{ selected.fillRatePct }}% · 차감 후 현재고 {{ selected.box?.onHandQty }}</p>
          <p>{{ selected.eventId }}</p>
        </aside>
      </section>
    </main>
    <footer class="foot">
      <div class="foot__block">
        <h3>서버 현재고</h3>
        <table>
          <tbody>
            <tr v-for="box in boxes" :key="box.id">
              <td>{{ box.code }}</td>
              <td>{{ stock(box) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="foot__block foot__log">
        <h3>최근 처리 · 재고 대기와 실패</h3>
        <ol>
          <li v-for="item in records" :key="`${item.kind}:${item.eventId}`" :class="item.kind">
            {{ item.kind === 'packed' ? '포장' : item.kind === 'waiting' ? '재고 대기' : '실패' }} ·
            {{ item.product?.name ?? item.eventId }} {{ item.box?.code ?? item.reason }}
          </li>
        </ol>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.live-scene {
  height: 100%;
}
.twin-live .waiting {
  color: #ffd166;
}
.twin-live .failed {
  color: #ff6b6b;
}
.twin-live .packed {
  color: #70e1b5;
}
.twin-live .foot {
  grid-template-columns: minmax(110px, 1fr) minmax(0, 2fr);
}
@media (max-width: 520px) {
  .twin-live .foot {
    grid-template-columns: 1fr;
    overflow: auto;
  }
  .twin-live .foot__block {
    min-height: 60px;
    max-height: 100px;
  }
}
</style>
