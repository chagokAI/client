// 헤더 벨 아이콘에서 열리는 알림 목록입니다.
// tone은 분류 라벨의 색 계열입니다. (danger/warning/info/neutral)
export const notifications = [
  {
    id: 'notif-1',
    category: '재고',
    tone: 'danger',
    title: 'M-1 중형 1호 안전 재고 미만',
    detail: '현재 820개 / 안전 재고 1,200개 · 380개 부족',
    time: '10분 전',
    unread: true,
  },
  {
    id: 'notif-2',
    category: '재고',
    tone: 'danger',
    title: 'L-4 대형 4호 안전 재고 미만',
    detail: '현재 650개 / 안전 재고 800개 · 150개 부족',
    time: '10분 전',
    unread: true,
  },
  {
    id: 'notif-3',
    category: '발주',
    tone: 'info',
    title: '박스 주문 발주서가 공급사에 전송되었어요',
    detail: 'PO-2026-1101 · 29,700개 · ₩10,566,000',
    time: '1시간 전',
    unread: true,
  },
  {
    id: 'notif-4',
    category: 'AI',
    tone: 'neutral',
    title: '11월 박스 주문 제안서가 생성되었어요',
    detail: '다음 달 예상 소모 33,600개 기준',
    time: '오늘 09:00',
    unread: false,
  },
  {
    id: 'notif-5',
    category: '매칭',
    tone: 'info',
    title: '검토가 필요한 상품 2건',
    detail: '캠핑 랜턴, 스니커즈 270mm · 포장공간비율 85% 미만',
    time: '어제',
    unread: false,
  },
]
