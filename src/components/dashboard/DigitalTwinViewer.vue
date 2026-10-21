<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountTwin } from '@/digital-twin/app'
import '@/digital-twin/twin.css'

// 물류공간 디지털트윈(초기 시연): 출고 이벤트를 흘려 박스를 고르고 트럭에 싣는 흐름을 3D 로 보여 준다.
// 3D·재생 로직은 src/digital-twin, 데이터는 기존 Spring API(simulation-state·box-inventories·box-specs·products)로 받는다.
const root = ref(null)
let unmount = null

onMounted(() => { unmount = mountTwin(root.value) })
onBeforeUnmount(() => unmount?.())

// 대시보드 카드의 '전체 화면' 버튼에서 부른다
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else root.value?.requestFullscreen?.()
}
defineExpose({ toggleFullscreen })
</script>

<template>
  <div ref="root" class="twin">
      <header class="bar">
        <div class="tabs" role="tablist">
          <button data-tab="base" class="on" role="tab">시뮬레이션</button>
          <button data-tab="compare" role="tab">비교 시뮬레이션</button>
        </div>
        <label id="proposalPick" hidden>제안서 <select id="proposal"></select></label>
        <label>시작 <input id="from" type="datetime-local" /></label>
        <label>끝 <input id="to" type="datetime-local" /></label>
        <label>최대 <input id="limit" type="number" min="1" max="20000" step="100" value="300" /> 건</label>
        <button id="load" class="primary">구간 불러오기</button>
        <span class="sep"></span>
        <button id="play" disabled>▶ 재생</button>
        <button id="step" disabled>한 건</button>
        <button id="skip" disabled>⏭ 결과로 건너뛰기</button>
        <label>속도 <input id="speed" type="range" min="0.5" max="200" step="0.5" value="2" /> <span id="speedLabel">2</span>건/초</label>
        <label>색상
          <select id="colorMode">
            <option value="code">호수별</option>
            <option value="fill">충전율</option>
          </select>
        </label>
        <span id="status" class="status">구간을 정해 불러오세요</span>
      </header>

      <main class="layout">
        <section class="stage">
          <div id="scene"></div>
          <div id="legend" class="legend"></div>
          <p class="hint-chip">트럭 안의 상자를 누르면 미니 3D·충전율·빈 공간·왜 이 상자인지 볼 수 있어요. 아래 호수·트럭 이름을 눌러도 됩니다.</p>
          <div id="now" class="now"></div>
          <div id="compare" class="cmp"></div>

          <aside id="popup" class="popup" hidden>
            <div class="popup__head">
              <nav id="crumbs" class="crumbs"></nav>
              <button id="popupClose" class="popup__close" aria-label="닫기">✕</button>
            </div>
            <div id="detail" class="detail"></div>
          </aside>
        </section>
      </main>

      <footer class="foot">
        <div class="foot__block"><h3>호수 통계</h3><div id="boxStats"></div></div>
        <div class="foot__block"><h3>트럭</h3><div id="trucks"></div></div>
        <div class="foot__block foot__log"><h3>기록</h3><ol id="log"></ol></div>
      </footer>
  </div>
</template>
