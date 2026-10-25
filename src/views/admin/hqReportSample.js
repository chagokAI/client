// TODO: 본부 효율화 리포트(hq_report_2027-01) 화면에서 옮겨 적은 예시 데이터입니다.
// 리포트 요약 API가 준비되면 교체합니다. 그때는 센터를 이름이 아니라 warehouseId 로 잇습니다.

// 판정 기준: 포장 규제 대상 출고 충진율 50%
export const FILL_TARGET = 50

export const reportSummary = {
  month: '2027-01',
  // 이번 달 = 전월 대비 늘어난 월 효과, 누적 = 11월부터 각 달 합
  monthSaving: 758756,
  annualSavingLabel: '약 911만 원',
  cumulativeSaving: 91712329,
  yearSavingLabel: '약 3억 8천만 원',
  monthCarbonKg: 416,
  cumulativeCarbonKg: 14996,
  fillRate: { from: 24.1, to: 55.1 },
  counts: { ok: 10, warn: 0, bad: 0 },
}

// 1차 제안 후 목표 미달·정체여서 충진율 목표 모드로 다시 제안한 센터
export const reruns = [{ center: '양재 센터', before: 40.3, after: 56.0, added: 3, saving: 758756, status: 'ok' }]

// fills: 11월·12월·1월 센터 충진율(%). base: 기본 7종만 쓸 때 충진율(%)
export const centerReports = [
  {
    name: '양재 센터',
    status: 'ok',
    shipments: 12183,
    monthSaving: 758756,
    cumulativeSaving: 19102560,
    cumulativeCarbonKg: 2679,
    base: 23.4,
    fills: [36.7, 40.3, 56.0],
    improvements: { month: 3, total: 8 },
  },
  {
    name: '송파 센터',
    status: 'ok',
    shipments: 10672,
    monthSaving: 0,
    cumulativeSaving: 12619602,
    cumulativeCarbonKg: 2052,
    base: 26.3,
    fills: [40.5, 50.6, 50.6],
    improvements: { month: 0, total: 8 },
  },
  {
    name: '수지 센터',
    status: 'ok',
    shipments: 9574,
    monthSaving: 0,
    cumulativeSaving: 13811871,
    cumulativeCarbonKg: 1989,
    base: 24.2,
    fills: [35.0, 53.2, 53.2],
    improvements: { month: 0, total: 7 },
  },
  {
    name: '부평 센터',
    status: 'ok',
    shipments: 7485,
    monthSaving: 0,
    cumulativeSaving: 13350676,
    cumulativeCarbonKg: 2106,
    base: 21.7,
    fills: [37.2, 56.4, 56.4],
    improvements: { month: 0, total: 8 },
  },
  {
    name: '부산 센터',
    status: 'ok',
    shipments: 7256,
    monthSaving: 0,
    cumulativeSaving: 10237876,
    cumulativeCarbonKg: 1747,
    base: 24.1,
    fills: [38.3, 55.6, 55.6],
    improvements: { month: 0, total: 8 },
  },
  {
    name: '광주 센터',
    status: 'ok',
    shipments: 4426,
    monthSaving: 0,
    cumulativeSaving: 5368861,
    cumulativeCarbonKg: 1156,
    base: 21.5,
    fills: [49.7, 56.6, 56.6],
    improvements: { month: 0, total: 10 },
  },
  {
    name: '원주 센터',
    status: 'ok',
    shipments: 4176,
    monthSaving: 0,
    cumulativeSaving: 4449735,
    cumulativeCarbonKg: 833,
    base: 24.5,
    fills: [34.8, 52.6, 52.6],
    improvements: { month: 0, total: 8 },
  },
  {
    name: '옥천 센터',
    status: 'ok',
    shipments: 6041,
    monthSaving: 0,
    cumulativeSaving: 8235754,
    cumulativeCarbonKg: 1526,
    base: 23.9,
    fills: [38.2, 61.8, 61.8],
    improvements: { month: 0, total: 8 },
  },
  {
    name: '제주 센터',
    status: 'ok',
    shipments: 2559,
    monthSaving: 0,
    cumulativeSaving: 2440683,
    cumulativeCarbonKg: 455,
    base: 26.5,
    fills: [34.0, 54.3, 54.3],
    improvements: { month: 0, total: 6 },
  },
  {
    name: '거제 센터',
    status: 'ok',
    shipments: 2006,
    monthSaving: 0,
    cumulativeSaving: 2094711,
    cumulativeCarbonKg: 453,
    base: 27.6,
    fills: [38.5, 58.8, 58.8],
    improvements: { month: 0, total: 8 },
  },
]

export const REPORT_MONTHS = ['11월', '12월', '1월']

// 판정 → 라벨·사유·StatusBadge 색
export const STATUS = {
  ok: { label: '양호', reason: '충진율 목표 달성', tone: 'success' },
  warn: { label: '주의', reason: '목표 미달 · 전월 대비 +2%p 이상 개선', tone: 'warning' },
  bad: { label: '개선 필요', reason: '목표 미달 · 전월 대비 +2%p 미만', tone: 'danger' },
}
