<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// 센터 위치를 CARTO 베이스맵 위에 핀으로 찍습니다. 핀에 마우스를 올리면 센터 이름이 보입니다.
// 핀을 누르면 그 센터의 warehouseId 를, 지도 빈 곳을 누르면 null 을 select 로 알립니다.
const props = defineProps({
  // { warehouseId, name, latitude, longitude } 목록
  centers: { type: Array, default: () => [] },
  // 선택된 센터의 warehouseId. 해당 핀을 크게 강조합니다.
  selectedId: { type: [String, Number], default: null },
})
const emit = defineEmits(['select'])

// 센터가 없을 때 보여 줄 남한 전체 범위
const KOREA_CENTER = [36.4, 127.8]
const KOREA_ZOOM = 8

// .env.local 의 VITE_CARTO_KEY. 프론트 키라 번들에 그대로 들어갑니다(숨길 수 없음).
const CARTO_KEY = import.meta.env.VITE_CARTO_KEY ?? ''

// 물방울 모양 핀. 가운데 구멍은 evenodd 로 뚫어 아래 지도가 비쳐 보입니다.
function pinIcon(width, height, className) {
  return L.divIcon({
    className,
    html: `<svg viewBox="0 0 24 32" width="${width}" height="${height}" aria-hidden="true">
      <path fill-rule="evenodd" d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0zm0 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9z"/>
    </svg>`,
    iconSize: [width, height],
    // 핀 끝(아래 꼭짓점)이 좌표에 오도록 맞춥니다.
    iconAnchor: [width / 2, height],
    // 이름표는 핀 머리 바로 위에 띄웁니다. 선택돼 핀이 커지면 함께 올라갑니다.
    tooltipAnchor: [0, -height - 4],
  })
}
const PIN_ICON = pinIcon(24, 32, 'center-map__pin')
const PIN_ICON_SELECTED = pinIcon(30, 40, 'center-map__pin center-map__pin--selected')

const el = ref(null)
let map = null
let pins = null
let observer = null
// warehouseId → 마커. 선택이 바뀔 때 지도를 다시 맞추지 않고 아이콘만 바꿉니다.
const markers = new Map()

function iconFor(id) {
  return id === props.selectedId ? PIN_ICON_SELECTED : PIN_ICON
}

function drawPins() {
  if (!map) return
  pins.clearLayers()
  markers.clear()
  const points = props.centers
    .filter((c) => Number.isFinite(c.latitude) && Number.isFinite(c.longitude))
    .map((c) => {
      const point = [c.latitude, c.longitude]
      // 기본 마커 이미지는 Vite 번들에서 경로가 깨지므로 SVG 핀(divIcon)을 씁니다.
      const marker = L.marker(point, { icon: iconFor(c.warehouseId), riseOnHover: true })
        .bindTooltip(c.name, { direction: 'top', className: 'center-map__label' })
        .on('click', () => emit('select', c.warehouseId))
        .addTo(pins)
      markers.set(c.warehouseId, marker)
      return point
    })
  if (points.length) map.fitBounds(points, { padding: [16, 16], maxZoom: 12 })
  else map.setView(KOREA_CENTER, KOREA_ZOOM)
}

onMounted(() => {
  map = L.map(el.value, { scrollWheelZoom: true, zoomSnap: 0.25 }).setView(KOREA_CENTER, KOREA_ZOOM)
  // CARTO Voyager(라벨 없음): 바다·녹지·도로 색은 살아 있고 글자만 빠진 스타일입니다.
  // 2026-09-25 부터 래스터 타일은 키가 있어야 합니다. 키가 없으면 워터마크만 보입니다.
  L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png?key=${CARTO_KEY}`, {
    // 래스터 타일은 18단계까지만 있고, 그보다 확대하면 같은 타일을 늘려 씁니다.
    maxNativeZoom: 18,
    maxZoom: 20,
    subdomains: 'abcd',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://carto.com/attribution/">CARTO</a>',
  }).addTo(map)

  pins = L.layerGroup().addTo(map)
  drawPins()
  // 마커 클릭은 지도로 전파되지 않으므로, 지도 클릭은 빈 곳을 누른 경우뿐입니다.
  map.on('click', () => emit('select', null))

  // 카드 높이가 바뀌면 지도도 크기를 다시 계산해야 타일이 비지 않습니다.
  observer = new ResizeObserver(() => map.invalidateSize())
  observer.observe(el.value)
})

watch(() => props.centers, drawPins, { deep: true })
watch(
  () => props.selectedId,
  () => {
    markers.forEach((marker, id) => {
      marker.setIcon(iconFor(id))
      // 선택된 핀이 다른 핀에 가리지 않도록 맨 위로 올립니다.
      marker.setZIndexOffset(id === props.selectedId ? 1000 : 0)
      // 이름표는 열릴 때의 핀 크기로 자리를 잡으므로, 핀이 커지거나 작아지면 다시 맞춥니다.
      if (marker.isTooltipOpen()) marker.getTooltip().update()
    })
  },
)

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
/* Leaflet 내부 요소는 z-index 를 400~1000 까지 씁니다(타일 200, 마커 600, 컨트롤 1000).
   이 값들이 페이지 전체와 겹치면 사이드바(60)·프로필 패널(70)·토스트(120)를 덮으므로,
   지도에 별도 쌓임 맥락을 만들어 지도 밖으로 나오지 못하게 가둡니다. */
.center-map {
  width: 100%;
  height: 100%;
  min-height: 320px;
  background: var(--color-cream-soft);
  isolation: isolate;
}

/* Leaflet이 만든 요소에는 scoped 속성이 붙지 않아 :deep()으로 꾸밉니다. */

.center-map :deep(.center-map__pin svg) {
  display: block;
  /* 밝은 크림 톤 지도 위에서 잘 보이도록 브랜드 갈색을 씁니다. */
  fill: var(--color-brown);
  filter: drop-shadow(0 1px 2px rgb(32 42 56 / 30%));
  cursor: pointer;
}

/* 선택된 핀은 크기를 키우고 골드로 강조합니다. */
.center-map :deep(.center-map__pin--selected svg) {
  fill: var(--color-gold);
  transform-origin: 50% 100%;
  animation: center-map-pin-pop 0.18s ease-out;
}

/* 아이콘이 통째로 바뀌므로 transition 대신, 핀 끝을 축으로 살짝 커지며 나타나게 합니다. */
@keyframes center-map-pin-pop {
  from {
    transform: scale(0.8);
  }
}

@media (prefers-reduced-motion: reduce) {
  .center-map :deep(.center-map__pin--selected svg) {
    animation: none;
  }
}

/* 핀 이름표: 핀과 같은 갈색 계열의 알약 모양 말풍선 */
.center-map :deep(.center-map__label) {
  padding: 5px 11px;
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--color-brown-darker);
  color: var(--color-white);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: -0.2px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgb(32 42 56 / 18%);
}

/* 아래 꼬리도 말풍선과 같은 색으로 맞춥니다. */
.center-map :deep(.center-map__label.leaflet-tooltip-top::before) {
  border-top-color: var(--color-brown-darker);
}
</style>
