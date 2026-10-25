// 목록 API 응답 한 건 → 표 한 행. 서버 원본 필드는 그대로 두고(...b) 표시용 값을 덧붙입니다.
// 상태 분기는 원본 필드(isActive, matchStatus, status 등)로 하고, *Label 은 표시에만 씁니다.
import { MATCH, ORDER, STOCK, currency, date, dimensions, number, quantity, time } from './format'

export function productRow(p) {
  return {
    ...p,
    categoryId: p.category?.id,
    category: p.category?.name ?? '—',
    size: dimensions(p.widthMm, p.depthMm, p.heightMm),
    matchedBox: p.matchedBoxSpec ? `${p.matchedBoxSpec.code} (${p.matchedBoxSpec.name})` : null,
    fillRate: p.fillRatePct ?? null,
    statusLabel: MATCH[p.matchStatus] ?? '미매칭',
  }
}
// 박스 재고/규격 관리 표의 한 행. 재고는 서버가 규격 한 건에 stock 하나로 묶어 내려줍니다.
// 재고 정책 수정·입고에 쓰는 id·version 은 규격의 값과 같습니다(같은 행에 저장되어 있습니다).
export function boxStockRow(b) {
  const stock = b.stock ?? {}
  return {
    ...b,
    sizeName: b.name,
    dimensions: dimensions(b.innerWidthMm, b.innerDepthMm, b.innerHeightMm),
    width: b.innerWidthMm,
    depth: b.innerDepthMm,
    height: b.innerHeightMm,
    supplierId: b.supplier?.id ?? '',
    supplier: b.supplier?.name ?? '미지정',
    leadTimeDays: b.supplier?.leadTimeDays ?? null,
    custom: b.isCustom,
    linkedProducts: b.linkedProductCount,
    statusLabel: b.isActive ? '사용 중' : '미사용',
    onHandQty: stock.onHandQty,
    safetyQty: stock.safetyQty,
    current: quantity(stock.onHandQty),
    safety: quantity(stock.safetyQty),
    level: stock.stockLevelPct,
    daysLeft: stock.daysToStockout == null ? '—' : `${stock.daysToStockout}일`,
    stockStatus: stock.status,
    stockStatusLabel: STOCK[stock.status],
  }
}
export function notificationRow(n) {
  const labels = { INVENTORY: '재고', PURCHASE: '발주', AI: 'AI', MATCHING: '매칭' }
  return {
    ...n,
    category: labels[n.category] ?? n.category,
    detail: n.message,
    time: time(n.createdAt),
    tone: n.category === 'INVENTORY' ? 'danger' : 'info',
  }
}
export function orderRow(o) {
  return {
    ...o,
    number: o.poNo,
    orderedAt: date(o.createdAt),
    supplier: o.supplierName ?? '미지정',
    specs: o.boxCodes?.length ? `${o.boxCodes[0]}${o.specCount > 1 ? ` 외 ${o.specCount - 1}개 규격` : ''}` : '—',
    quantity: quantity(o.totalQty),
    amount: currency(o.totalAmountKrw),
    deliveryAt: date(o.deliveryDate),
    statusLabel: ORDER[o.status] ?? o.status,
  }
}
