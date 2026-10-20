// 메인 대시보드에서 쓰는 요약 수치입니다.
// TODO: 운영 API 연동 시 이 모듈 대신 서버 응답을 사용합니다.

export const forecast = {
  period: '다음 달',
  basis: '11월 출고 예측 35,100건 기준',
  total: '33,600개',
  comparison: '이번 달 소모량 대비',
  change: '+16.1%',
  breakdown: [
    { id: 'S', label: 'S (소형)', quantity: '12,600개', ratio: 37.5, tone: 'gold' },
    { id: 'M', label: 'M (중형)', quantity: '14,800개', ratio: 44, tone: 'brown' },
    { id: 'L', label: 'L (대형)', quantity: '6,200개', ratio: 18.5, tone: 'sand' },
  ],
  insights: [
    '중형(M) 박스 수요가 가장 많이 늘어요. 이번 달 대비 +12%',
    'M-1 규격은 현재 재고 4일분으로 발주가 필요해요',
    '연말 프로모션 영향으로 11월 셋째 주에 수요가 몰릴 예정이에요',
  ],
}

export const inventorySummary = {
  asOf: '기준 10.19 15:00',
  current: { label: '이번 달 재고', value: '12,840개', hint: '8개 규격 · 안전 재고 합계 8,800개' },
  next: { label: '다음 달 예상 재고', value: '8,940개', hint: '발주 29,700개 반영 · 예상 소모 33,600개' },
  shortageNote: '부족 2개 규격 포함',
  bySize: [
    { id: 'S', label: 'S (소형)', quantity: '6,750개', ratio: 6750, tone: 'gold' },
    { id: 'M', label: 'M (중형)', quantity: '4,200개', ratio: 4200, tone: 'brown' },
    { id: 'L', label: 'L (대형)', quantity: '1,890개', ratio: 1890, tone: 'sand' },
  ],
}

export const costSummary = {
  note: 'VAT 별도',
  items: [
    {
      id: 'packing-cost',
      label: '이번 달 예상 포장비용',
      hint: '전월 대비 −4.1% · 전년 대비 −12.4%',
      hintTone: 'success',
      value: '₩13,350,000',
      valueTone: 'default',
    },
    {
      id: 'monthly-saving',
      label: '월 포장비 절감액',
      hint: '전월 대비 +14%',
      hintTone: 'info',
      value: '₩3,420,000',
      valueTone: 'info',
    },
    {
      id: 'next-order',
      label: '다음 달 박스 발주 예정',
      hint: '29,700개 · 8개 규격',
      hintTone: 'muted',
      value: '₩10,566,000',
      valueTone: 'default',
    },
  ],
}

export const safetyStockAlerts = {
  count: '2개 규격',
  items: [
    {
      id: 'M-1',
      code: 'M-1',
      name: '중형 1호',
      shortage: '380개 부족',
      detail: '현재 820개 / 안전 재고 1,200개 · 약 4일 후 소진',
      ratio: 68,
    },
    {
      id: 'L-4',
      code: 'L-4',
      name: '대형 4호',
      shortage: '150개 부족',
      detail: '현재 650개 / 안전 재고 800개 · 약 5일 후 소진',
      ratio: 81,
    },
  ],
}
