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
</script>

<template>
  <div ref="root" class="twin">
      <header class="bar">
        <strong class="brand">차곡 물류공간 디지털트윈</strong>
        <label>시작 <input id="from" type="datetime-local" /></label>
        <label>끝 <input id="to" type="datetime-local" /></label>
        <label>최대 <input id="limit" type="number" min="1" max="1500" value="300" /> 건</label>
        <button id="load" class="primary">구간 불러오기</button>
        <span class="sep"></span>
        <button id="play" disabled>▶ 재생</button>
        <button id="step" disabled>한 건</button>
        <label>속도 <input id="speed" type="range" min="0.5" max="40" step="0.5" value="2" /> <span id="speedLabel">2</span>건/초</label>
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
          <div id="now" class="now"></div>
        </section>

        <aside class="side">
          <nav id="crumbs" class="crumbs"></nav>
          <div id="detail" class="detail">
            <p class="hint">컨베이어로 들어온 물품마다 DL 측정 치수로 박스를 고르고, 트럭 안쪽부터 쌓습니다.<br />
              트럭 안의 상자를 누르면 왜 그 상자인지 볼 수 있어요.</p>
          </div>
        </aside>
      </main>

      <footer class="foot">
        <div class="foot__block"><h3>호수 통계</h3><div id="boxStats"></div></div>
        <div class="foot__block"><h3>트럭</h3><div id="trucks"></div></div>
        <div class="foot__block foot__log"><h3>기록</h3><ol id="log"></ol></div>
      </footer>
  </div>
</template>
