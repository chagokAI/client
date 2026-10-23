<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// 센터 위치를 OSM 지도 위에 핀으로 찍습니다. 핀에 마우스를 올리면 센터 이름이 보입니다.
const props = defineProps({
  // { warehouseId, name, latitude, longitude } 목록
  centers: { type: Array, default: () => [] },
})

// 센터가 없을 때 보여 줄 남한 전체 범위
const KOREA_CENTER = [36.4, 127.8]
const KOREA_ZOOM = 8

const el = ref(null)
let map = null
let pins = null
let observer = null

function drawPins() {
  if (!map) return
  pins.clearLayers()
  const points = props.centers
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    .map((c) => {
      const point = [c.latitude, c.longitude]
      // 기본 마커 이미지는 Vite 번들에서 경로가 깨지므로 벡터 핀(circleMarker)을 씁니다.
      L.circleMarker(point, { radius: 8, className: 'center-map__pin' })
        .bindTooltip(c.name, { direction: 'top', offset: [0, -8] })
        .addTo(pins)
      return point
    })
  if (points.length) map.fitBounds(points, { padding: [16, 16], maxZoom: 12 })
  else map.setView(KOREA_CENTER, KOREA_ZOOM)
}

onMounted(() => {
  map = L.map(el.value, { scrollWheelZoom: false, zoomSnap: 0.25 }).setView(KOREA_CENTER, KOREA_ZOOM)
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map)
  pins = L.layerGroup().addTo(map)
  drawPins()

  // 카드 높이가 바뀌면 지도도 크기를 다시 계산해야 타일이 비지 않습니다.
  observer = new ResizeObserver(() => map.invalidateSize())
  observer.observe(el.value)
})

watch(() => props.centers, drawPins, { deep: true })

onBeforeUnmount(() => {
  observer?.disconnect()
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="center-map" />
</template>

<style scoped>
.center-map {
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: var(--color-cream-soft);
}

/* Leaflet이 만든 요소에는 scoped 속성이 붙지 않아 :deep()으로 꾸밉니다. */
.center-map :deep(.center-map__pin) {
  fill: var(--color-gold);
  fill-opacity: 0.9;
  stroke: var(--color-brown);
  stroke-width: 2;
}

.center-map :deep(.leaflet-tooltip) {
  border: 1px solid var(--color-card-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: 12px;
  font-weight: 600;
  box-shadow: none;
}
</style>
