<script setup>
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api/client'
import ApiState from '@/components/common/ApiState.vue'
import AppCard from '@/components/common/AppCard.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import CenterMap from '@/components/admin/CenterMap.vue'
import FillRateChart from '@/components/admin/FillRateChart.vue'
import { useRemote } from '@/composables/useRemote'
import { centerReports, FILL_TARGET, REPORT_MONTHS, reportSummary, reruns, STATUS } from './hqReportSample'

// 센터 위치: 좌표가 등록된 센터만 지도에 핀으로 찍습니다.
const { loading, error, load } = useRemote()
const centers = ref([])

function refresh() {
  return load(
    (signal) => api('/admin/warehouses', { signal }),
    (response) => {
      centers.value = response.data
    },
  )
}
onMounted(refresh)

// 지도에서 핀을 누르면 오른쪽 패널을 그 센터 리포트로 바꿉니다. 기본(null)은 본부 전체 요약입니다.
const selectedId = ref(null)
const selectedCenter = computed(() => centers.value.find((c) => c.warehouseId === selectedId.value) ?? null)

// TODO: 예시 리포트는 센터 이름으로만 묶여 있어 이름으로 찾습니다. API로 바꾸면 warehouseId 로 찾습니다.
const selectedReport = computed(() => centerReports.find((r) => r.name === selectedCenter.value?.name) ?? null)
const selectedReruns = computed(() => reruns.filter((r) => r.center === selectedCenter.value?.name))

function selectByName(name) {
  const center = centers.value.find((c) => c.name === name)
  if (center) selectedId.value = center.warehouseId
}

// 오른쪽 패널은 지도 위에 겹치는 드로어입니다. 처음엔 닫혀 있고, 핀을 누르면 열립니다.
// 너비는 CSS 의 .drawer 너비(380px)와 같게 맞춥니다. 지도가 선택한 핀을 드로어 밖으로 옮길 때 씁니다.
const DRAWER_WIDTH = 380
const drawerOpen = ref(false)

function onSelect(id) {
  selectedId.value = id
  if (id) drawerOpen.value = true
}

const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`
const signedWon = (n) => `${n >= 0 ? '+' : '−'}${won(Math.abs(n))}`
const kg = (n) => `${Math.round(n).toLocaleString('ko-KR')} kg`
const pointDelta = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(1)}%p`

// 선택한 센터의 이번 달 충진율과 전월 대비 변화
const centerFill = computed(() => {
  const fills = selectedReport.value?.fills ?? []
  return { now: fills.at(-1), delta: fills.at(-1) - fills.at(-2) }
})
</script>

<template>
  <div class="admin-dashboard">
    <PageHeader
      title="실시간 센터 현황"
      description="전체 센터의 운영 성과와 조치가 필요한 항목을 한곳에서 확인합니다."
    />

    <ApiState :loading="loading" :error="error" @retry="refresh" />

    <div class="admin-dashboard__stage">
      <!-- 지도는 카드 장식 없이 영역을 꽉 채웁니다. -->
      <CenterMap
        class="admin-dashboard__map"
        :centers="centers"
        :selected-id="selectedId"
        :right-inset="drawerOpen ? DRAWER_WIDTH : 0"
        @select="onSelect"
      />

      <div class="drawer" :class="{ 'drawer--open': drawerOpen }">
        <!-- 손잡이는 드로어 왼쪽 가장자리에 붙어 함께 움직입니다. -->
        <button
          type="button"
          class="drawer__toggle"
          aria-controls="center-drawer"
          :aria-expanded="drawerOpen"
          :aria-label="drawerOpen ? '센터 현황 패널 닫기' : '센터 현황 패널 열기'"
          @click="drawerOpen = !drawerOpen"
        >
          <svg class="drawer__chevron" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>

        <div id="center-drawer" class="admin-dashboard__side" :inert="!drawerOpen">
          <div class="scope">
            <div class="scope__text">
              <p class="scope__eyebrow">
                {{ selectedCenter ? '선택한 센터' : '본부 전체 요약' }} · {{ reportSummary.month }} 리포트
              </p>
              <p class="scope__name">{{ selectedCenter?.name ?? '전체 센터' }}</p>
            </div>
            <button v-if="selectedCenter" type="button" class="scope__reset" @click="selectedId = null">
              전체 보기
            </button>
          </div>

          <!-- 본부 전체 요약 -->
          <template v-if="!selectedCenter">
            <AppCard title="절감 효과" meta="박스비 + 운임">
              <div class="figure">
                <p class="figure__label">이번 달 · 전월 대비</p>
                <p class="figure__value">{{ signedWon(reportSummary.monthSaving) }}</p>
                <p class="figure__sub">연 {{ reportSummary.annualSavingLabel }} 추정</p>
              </div>
              <dl class="stats">
                <div>
                  <dt>누적 절감 <small>11~1월</small></dt>
                  <dd>{{ won(reportSummary.cumulativeSaving) }}</dd>
                </div>
                <div>
                  <dt>1년 예상</dt>
                  <dd>{{ reportSummary.yearSavingLabel }}</dd>
                </div>
                <div>
                  <dt>누적 탄소 감축</dt>
                  <dd>{{ kg(reportSummary.cumulativeCarbonKg) }}</dd>
                </div>
                <div>
                  <dt>평균 충진율</dt>
                  <dd>{{ reportSummary.fillRate.from }} → {{ reportSummary.fillRate.to }}%</dd>
                </div>
              </dl>
            </AppCard>

            <AppCard title="센터 판정" :meta="`목표 충진율 ${FILL_TARGET}%`">
              <ul class="counts">
                <li v-for="(meta, key) in STATUS" :key="key" class="counts__item" :class="`counts__item--${key}`">
                  <span>{{ meta.label }}</span>
                  <strong>{{ reportSummary.counts[key] }}<small>곳</small></strong>
                </li>
              </ul>

              <h3 class="subhead">이번 달 재실행</h3>
              <ul v-if="reruns.length" class="rerun">
                <li v-for="item in reruns" :key="item.center">
                  <button type="button" class="rerun__item" @click="selectByName(item.center)">
                    <span class="rerun__text">
                      <span class="rerun__title">{{ item.center }}</span>
                      <span class="rerun__detail">
                        충진율 {{ item.before.toFixed(1) }} → {{ item.after.toFixed(1) }}% · 신규 규격
                        {{ item.added }}종
                      </span>
                    </span>
                    <StatusBadge :label="STATUS[item.status].label" :tone="STATUS[item.status].tone" />
                  </button>
                </li>
              </ul>
              <p v-else class="empty">이번 달 재실행한 센터가 없습니다.</p>
            </AppCard>
          </template>

          <!-- 선택한 센터 -->
          <template v-else-if="selectedReport">
            <AppCard title="충진율">
              <template #actions>
                <StatusBadge :label="STATUS[selectedReport.status].label" :tone="STATUS[selectedReport.status].tone" />
              </template>
              <div class="figure">
                <p class="figure__label">{{ STATUS[selectedReport.status].reason }}</p>
                <p class="figure__value">
                  {{ centerFill.now.toFixed(1) }}%
                  <span class="delta" :class="{ 'delta--flat': centerFill.delta === 0 }">
                    {{ pointDelta(centerFill.delta) }}
                  </span>
                </p>
                <p class="figure__sub">전월 대비 · 목표 {{ FILL_TARGET }}%</p>
              </div>
              <FillRateChart
                :base="selectedReport.base"
                :fills="selectedReport.fills"
                :months="REPORT_MONTHS"
                :target="FILL_TARGET"
              />
            </AppCard>

            <AppCard title="절감 효과" meta="박스비 + 운임">
              <div class="figure">
                <p class="figure__label">이번 달 · 전월 대비</p>
                <p class="figure__value">{{ signedWon(selectedReport.monthSaving) }}</p>
              </div>
              <dl class="stats">
                <div>
                  <dt>누적 절감 <small>11~1월</small></dt>
                  <dd>{{ won(selectedReport.cumulativeSaving) }}</dd>
                </div>
                <div>
                  <dt>누적 탄소 감축</dt>
                  <dd>{{ kg(selectedReport.cumulativeCarbonKg) }}</dd>
                </div>
                <div>
                  <dt>출고</dt>
                  <dd>{{ selectedReport.shipments.toLocaleString('ko-KR') }}건</dd>
                </div>
                <div>
                  <dt>개선 반영</dt>
                  <dd>
                    {{ selectedReport.improvements.month }}건
                    <small>/ 누적 {{ selectedReport.improvements.total }}건</small>
                  </dd>
                </div>
              </dl>
            </AppCard>

            <AppCard v-if="selectedReruns.length" title="이번 달 재실행">
              <p v-for="item in selectedReruns" :key="item.center" class="rerun__note">
                1차 제안 후 충진율이 {{ item.before.toFixed(1) }}%에 머물러 충진율 목표 모드로 다시 제안했습니다. 신규
                규격 {{ item.added }}종을 반영해 <b>{{ item.after.toFixed(1) }}%</b>가 되었고, 월 비용은
                {{ won(item.saving) }} 줄었습니다.
              </p>
            </AppCard>
          </template>

          <div v-else class="side-empty">
            <p class="empty">{{ reportSummary.month }} 리포트에 이 센터 데이터가 없습니다.</p>
          </div>

          <p class="sample-note">예시 데이터 · 본부 효율화 리포트 {{ reportSummary.month }} 기준</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 지도가 영역 전체를 차지하고, 패널은 그 위 오른쪽에서 드로어로 밀려 나옵니다.
   좁은 화면에서는 화면 높이의 70% 정도로 둡니다. */
.admin-dashboard__stage {
  position: relative;
  height: min(70svh, 640px);
  min-height: 420px;
  overflow: hidden;
}

.admin-dashboard__map {
  position: absolute;
  inset: 0;
  border-radius: 0;
}

/* 넓은 화면: 본문 여백(위 40 + 아래 72)을 뺀 높이에 맞춰 한 화면에 담습니다. */
@media (min-width: 1181px) {
  .admin-dashboard {
    display: flex;
    flex-direction: column;
    height: calc(100svh - 112px);
  }

  .admin-dashboard__stage {
    flex: 1;
    height: auto;
    min-height: 0;
  }
}

/* 드로어: 닫히면 오른쪽 밖으로 빠지고 손잡이만 지도 위에 남습니다. */
.drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  width: min(380px, calc(100% - 48px));
  transform: translateX(100%);
  transition: transform 0.25s ease;
}

.drawer--open {
  transform: none;
}

.drawer__toggle {
  position: absolute;
  top: 16px;
  right: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--color-card-border);
  border-right: 0;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
  background: var(--color-white);
  color: var(--color-brown);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: -2px 2px 8px rgb(32 42 56 / 10%);
  cursor: pointer;
}

.drawer__toggle:hover {
  background: var(--color-cream);
}

/* 닫힘: ‹ (열기) · 열림: › (닫기) */
.drawer__chevron {
  transition: transform 0.25s ease;
}

.drawer--open .drawer__chevron {
  transform: rotate(180deg);
}

/* 패널 본문. 세로로 길어지면 패널 안에서만 스크롤됩니다. */
.admin-dashboard__side {
  height: 100%;
  overflow-y: auto;
  background: var(--color-white);
}

.drawer--open .admin-dashboard__side {
  box-shadow: var(--shadow-popover);
}

@media (prefers-reduced-motion: reduce) {
  .drawer,
  .drawer__chevron {
    transition: none;
  }
}

/* 패널 안에서는 카드 테두리를 걷고 구분선으로만 나눕니다. */
.admin-dashboard__side :deep(.app-card) {
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.admin-dashboard__side :deep(.app-card + .app-card) {
  border-top: 1px solid var(--color-divider);
}

/* 패널 맨 위: 지금 보고 있는 범위(전체 또는 선택한 센터) */
.scope {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--color-divider);
  background: var(--color-cream);
}

.scope__text {
  min-width: 0;
}

.scope__eyebrow {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 600;
}

.scope__name {
  margin: 2px 0 0;
  color: var(--color-brown);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.3px;
}

.scope__reset {
  flex: none;
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-white);
  color: var(--color-brown);
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.scope__reset:hover {
  background: var(--color-cream-strong);
}

/* 카드 맨 위의 대표 숫자 */
.figure {
  margin-bottom: 16px;
}

.figure__label {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.figure__value {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 2px 0 0;
  color: var(--color-text);
  font-size: 26px;
  font-weight: 800;
  letter-spacing: -0.5px;
  font-variant-numeric: tabular-nums;
}

.figure__sub {
  margin: 2px 0 0;
  color: var(--color-text-muted);
  font-size: 12px;
}

.delta {
  color: var(--color-success-text);
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
}

.delta--flat {
  color: var(--color-text-muted);
}

/* 2열 보조 지표 */
.stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0;
}

.stats div {
  padding: 11px 14px;
  border-radius: var(--radius-md);
  background: var(--color-cream-soft);
}

.stats dt {
  color: var(--color-text-muted);
  font-size: 11px;
}

.stats dd {
  margin: 3px 0 0;
  color: var(--color-text);
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  word-break: keep-all;
}

.stats small {
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 500;
}

/* 판정별 센터 수 */
.counts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.counts__item {
  padding: 10px 12px;
  border-top: 3px solid var(--color-success);
  border-radius: var(--radius-md);
  background: var(--color-cream-soft);
}

.counts__item--warn {
  border-top-color: var(--color-warning);
}

.counts__item--bad {
  border-top-color: var(--color-danger);
}

.counts__item span {
  display: block;
  color: var(--color-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.counts__item strong {
  font-size: 20px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.counts__item small {
  margin-left: 2px;
  color: var(--color-text-muted);
  font-size: 11px;
  font-weight: 500;
}

.subhead {
  margin: 18px 0 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 700;
}

/* 재실행 목록: 누르면 그 센터를 선택합니다. */
.rerun {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rerun__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--color-cream-soft);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.rerun__item:hover {
  background: var(--color-cream);
}

.rerun__text {
  display: grid;
  min-width: 0;
}

.rerun__title {
  font-size: 13px;
  font-weight: 600;
}

.rerun__detail {
  margin-top: 2px;
  color: var(--color-text-muted);
  font-size: 11px;
}

.rerun__note {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 12px;
  line-height: 1.6;
  word-break: keep-all;
}

.side-empty {
  padding: 20px 24px;
}

.empty {
  margin: 0;
  padding: 13px 16px;
  border-radius: var(--radius-md);
  background: var(--color-cream-soft);
  color: var(--color-text-muted);
  font-size: 12px;
}

.sample-note {
  margin: 0;
  padding: 12px 24px 20px;
  color: var(--color-text-muted);
  font-size: 11px;
}
</style>
