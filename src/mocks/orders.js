// 박스 주문(AI 제안서 + 발주서)과 발주서 이력에서 쓰는 데이터입니다.
// TODO: 운영 API 연동 시 이 모듈 대신 서버 응답을 사용합니다.

export const orderPeriod = '발주 대상 기간  2026.11.01 – 11.30'

export const proposal = {
  createdAt: '생성 2026.10.19 09:00',
  headline: '11월 예상 출고 35,100건 기준, 8개 규격 총 29,700개 주문을 제안합니다.',
  subline: '수요예측 정확도 94.3% · 규격별 안전 재고(7일분) 반영',
  rows: [
    { id: 'S-1', code: 'S-1', current: '2,400', expected: '4,200', safety: '1,500', suggested: '3,300개' },
    { id: 'S-2', code: 'S-2', current: '3,100', expected: '5,100', safety: '1,800', suggested: '3,800개' },
    { id: 'S-3', code: 'S-3', current: '1,250', expected: '3,300', safety: '1,000', suggested: '3,100개' },
    { id: 'M-1', code: 'M-1', current: '820', expected: '6,400', safety: '1,200', suggested: '6,800개' },
    { id: 'M-2', code: 'M-2', current: '1,900', expected: '4,900', safety: '1,000', suggested: '4,000개' },
    { id: 'M-3', code: 'M-3', current: '1,480', expected: '3,500', safety: '900', suggested: '2,900개' },
    { id: 'L-1', code: 'L-1', current: '1,240', expected: '3,900', safety: '600', suggested: '3,300개' },
    { id: 'L-4', code: 'L-4', current: '650', expected: '2,300', safety: '800', suggested: '2,500개' },
  ],
  rationale: [
    '11월 출고 예측 35,100건, 이번 달 대비 8.3% 증가 (연말 프로모션 시즌 반영)',
    '최근 4주간 M-1 규격 사용량 12% 증가 · 현재 재고가 4일분으로 부족',
    '규격별 안전 재고 7일분과 공급사 리드타임 5일을 반영해 수량 산정',
    '제안 수량 = 다음 달 예상 소모 + 안전 재고 − 현재 재고 (100개 단위 반올림)',
  ],
  totalAmount: '₩10,566,000',
  comparisons: [
    { id: 'prev-month', label: '전월 대비 · 10월 발주 ₩9,780,000', change: '▲ +8.0%  (+₩786,000)' },
    { id: 'prev-year', label: '전년 동월 대비 · 2025.11 발주 ₩9,120,000', change: '▲ +15.9%  (+₩1,446,000)' },
  ],
}

export const purchaseOrderDraft = {
  number: '발주번호 PO-2026-1101',
  status: '승인 대기',
  info: [
    { id: 'supplier', label: '공급사', value: 'OO 포장산업' },
    { id: 'due-date', label: '납품 희망일', value: '2026.11.03 (화)' },
    { id: 'requester', label: '요청자', value: '김차곡 매니저 · 물류운영팀' },
    { id: 'approver', label: '승인자', value: '박물류 센터장' },
    { id: 'destination', label: '납품처', value: 'OO 물류센터 (이천 본센터)' },
    { id: 'address', label: '납품 주소', value: '경기도 이천시 마장면 물류로 123, 2동 입고장' },
    { id: 'receiver', label: '수령 담당자', value: '이입고 대리 · 031-000-0000' },
    { id: 'hours', label: '입고 가능 시간', value: '평일 09:00–17:00 · 3번 도크' },
  ],
  // quantity는 QuantityStepper로 조정되므로 숫자로 둡니다.
  items: [
    { id: 'S-1', code: 'S-1', size: '200 × 150 × 100', quantity: 3300, unitPrice: 180 },
    { id: 'S-2', code: 'S-2', size: '250 × 180 × 120', quantity: 3800, unitPrice: 210 },
    { id: 'S-3', code: 'S-3', size: '300 × 200 × 150', quantity: 3100, unitPrice: 250 },
    { id: 'M-1', code: 'M-1', size: '350 × 250 × 200', quantity: 6800, unitPrice: 320 },
    { id: 'M-2', code: 'M-2', size: '400 × 300 × 250', quantity: 4000, unitPrice: 380 },
    { id: 'M-3', code: 'M-3', size: '450 × 350 × 300', quantity: 2900, unitPrice: 450 },
    { id: 'L-1', code: 'L-1', size: '500 × 400 × 350', quantity: 3300, unitPrice: 560 },
    { id: 'L-4', code: 'L-4', size: '650 × 200 × 200', quantity: 2500, unitPrice: 620 },
  ],
  note: 'AI 제안서 수량이 자동으로 입력되었습니다. −/+ 버튼으로 100개 단위로 수정하면 총 수량과 합계가 바로 바뀝니다.',
}

// 입고 등록 모달에서 고를 수 있는, 아직 입고되지 않은 발주서입니다.
export const openPurchaseOrderOptions = [
  {
    value: 'PO-2026-1012',
    label: 'PO-2026-1012',
    specIds: ['M-1', 'M-2', 'M-3'],
    quantityBySpec: { 'M-1': 6400, 'M-2': 2400, 'M-3': 1800 },
  },
  {
    value: 'PO-2026-1101',
    label: 'PO-2026-1101',
    specIds: ['S-1', 'S-2', 'S-3', 'M-1', 'M-2', 'M-3', 'L-1', 'L-4'],
    quantityBySpec: {
      'S-1': 3300,
      'S-2': 3800,
      'S-3': 3100,
      'M-1': 6800,
      'M-2': 4000,
      'M-3': 2900,
      'L-1': 3300,
      'L-4': 2500,
    },
  },
]

// 발주서 반려 모달의 사유 선택지
export const rejectReasons = [
  { value: '수량 과다', label: '수량 과다' },
  { value: '단가 재협의', label: '단가 재협의' },
  { value: '납품일 조정', label: '납품일 조정' },
  { value: '공급사 변경', label: '공급사 변경' },
  { value: '기타', label: '기타' },
]

export const historyPeriod = '조회 기간  2026.08.01 – 2026.10.19'

export const historyStats = [
  { id: 'count', label: '누적 발주 건수', value: '24건', hint: '최근 3개월 기준' },
  { id: 'amount', label: '누적 발주 금액', value: '₩58,940,000', hint: '이번 달 ₩10,566,000 (승인 대기 포함)' },
  { id: 'pending', label: '승인 대기', value: '1건', hint: 'AI 제안서 생성 · 검토 필요' },
  { id: 'lead-time', label: '평균 납품 리드타임', value: '4.6일', hint: '공급사 약정 5일 이내' },
]

export const purchaseOrders = [
  {
    id: 'PO-2026-1101',
    number: 'PO-2026-1101',
    orderedAt: '2026.10.19',
    supplier: 'OO 포장산업',
    specs: 'S-1 외 7개 규격',
    quantity: '29,700개',
    amount: '₩10,566,000',
    deliveryAt: '2026.11.03',
    status: '승인 대기',
    highlight: true,
  },
  {
    id: 'PO-2026-1012',
    number: 'PO-2026-1012',
    orderedAt: '2026.10.12',
    supplier: 'OO 포장산업',
    specs: 'M-1 외 2개 규격',
    quantity: '6,400개',
    amount: '₩2,048,000',
    deliveryAt: '2026.10.17',
    status: '배송 중',
  },
  {
    id: 'PO-2026-1005',
    number: 'PO-2026-1005',
    orderedAt: '2026.10.05',
    supplier: '△△ 박스',
    specs: 'L-4 외 1개 규격',
    quantity: '2,800개',
    amount: '₩1,736,000',
    deliveryAt: '2026.10.10',
    status: '입고 완료',
  },
  {
    id: 'PO-2026-1001',
    number: 'PO-2026-1001',
    orderedAt: '2026.10.01',
    supplier: 'OO 포장산업',
    specs: 'S-2 외 5개 규격',
    quantity: '27,500개',
    amount: '₩9,780,000',
    deliveryAt: '2026.10.06',
    status: '입고 완료',
  },
  {
    id: 'PO-2026-0924',
    number: 'PO-2026-0924',
    orderedAt: '2026.09.24',
    supplier: '□□ 패키징',
    specs: 'M-2 외 1개 규격',
    quantity: '3,000개',
    amount: '₩1,140,000',
    deliveryAt: '—',
    status: '반려',
  },
  {
    id: 'PO-2026-0915',
    number: 'PO-2026-0915',
    orderedAt: '2026.09.15',
    supplier: '△△ 박스',
    specs: 'M-3 외 2개 규격',
    quantity: '4,100개',
    amount: '₩1,845,000',
    deliveryAt: '2026.09.19',
    status: '입고 완료',
  },
  {
    id: 'PO-2026-0901',
    number: 'PO-2026-0901',
    orderedAt: '2026.09.01',
    supplier: 'OO 포장산업',
    specs: 'S-1 외 7개 규격',
    quantity: '25,900개',
    amount: '₩9,210,000',
    deliveryAt: '2026.09.05',
    status: '입고 완료',
  },
  {
    id: 'PO-2026-0818',
    number: 'PO-2026-0818',
    orderedAt: '2026.08.18',
    supplier: 'OO 포장산업',
    specs: 'L-1 외 1개 규격',
    quantity: '2,600개',
    amount: '₩1,456,000',
    deliveryAt: '2026.08.22',
    status: '입고 완료',
  },
]

export const historyTotalPages = 3

// 필터 칩에 표시하는 건수는 현재 페이지가 아니라 전체 24건 기준입니다.
export const historyStatusCounts = {
  total: 24,
  '승인 대기': 1,
  '승인 완료': 0,
  '배송 중': 1,
  '입고 완료': 21,
  반려: 1,
}

export const historySortOptions = [
  { value: 'ordered-desc', label: '최신 발주일 순' },
  { value: 'ordered-asc', label: '오래된 발주일 순' },
  { value: 'amount-desc', label: '발주 금액 높은 순' },
]

// 발주서 상세 모달에서 쓰는 진행 단계
export const purchaseOrderSteps = ['제안서 생성', '발주서 작성', '승인 대기', '발주 완료', '입고 완료']

// 상세 모달에 표시할 발주서별 상세 정보. 지금은 승인 대기 건만 채워져 있습니다.
export const purchaseOrderDetails = {
  'PO-2026-1101': {
    number: 'PO-2026-1101',
    status: '승인 대기',
    currentStepIndex: 2,
    caption: 'PO-2026-1101 · AI 제안서 기반 (2026.10.19 09:00 생성)',
    info: [
      { id: 'ordered-at', label: '발주일', value: '2026.10.19 (월)' },
      { id: 'supplier', label: '공급사', value: 'OO 포장산업' },
      { id: 'delivery-at', label: '납품 예정일', value: '2026.11.03 (화)' },
      { id: 'requester', label: '요청자', value: '김차곡 매니저 · 물류운영팀' },
      { id: 'approver', label: '승인자', value: '박물류 센터장' },
      { id: 'payment', label: '결제 조건', value: '월말 정산 · VAT 별도' },
    ],
    items: [
      { id: 'S-1', code: 'S-1', size: '200 × 150 × 100', quantity: '3,300개', unitPrice: '₩180', amount: '₩594,000' },
      { id: 'S-2', code: 'S-2', size: '250 × 180 × 120', quantity: '3,800개', unitPrice: '₩210', amount: '₩798,000' },
      { id: 'S-3', code: 'S-3', size: '300 × 200 × 150', quantity: '3,100개', unitPrice: '₩250', amount: '₩775,000' },
      { id: 'M-1', code: 'M-1', size: '350 × 250 × 200', quantity: '6,800개', unitPrice: '₩320', amount: '₩2,176,000' },
      { id: 'M-2', code: 'M-2', size: '400 × 300 × 250', quantity: '4,000개', unitPrice: '₩380', amount: '₩1,520,000' },
      { id: 'M-3', code: 'M-3', size: '450 × 350 × 300', quantity: '2,900개', unitPrice: '₩450', amount: '₩1,305,000' },
      { id: 'L-1', code: 'L-1', size: '500 × 400 × 350', quantity: '3,300개', unitPrice: '₩560', amount: '₩1,848,000' },
      { id: 'L-4', code: 'L-4', size: '650 × 200 × 200', quantity: '2,500개', unitPrice: '₩620', amount: '₩1,550,000' },
    ],
    totalQuantity: '총 수량  29,700개',
    totalAmount: '₩10,566,000',
  },
}
