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
export function specRow(b) {
  return {
    ...b,
    sizeName: b.name,
    dimensions: dimensions(b.innerWidthMm, b.innerDepthMm, b.innerHeightMm),
    width: b.innerWidthMm,
    depth: b.innerDepthMm,
    height: b.innerHeightMm,
    supplierId: b.supplier?.id ?? '',
    supplier: b.supplier?.name ?? '미지정',
    custom: b.isCustom,
    linkedProducts: b.linkedProductCount,
    statusLabel: b.isActive ? '사용 중' : '미사용',
  }
}
export function inventoryRow(b) {
  return {
    ...b,
    id: b.inventoryId,
    code: b.boxCode,
    sizeName: b.boxName,
    dimensions: dimensions(b.innerWidthMm, b.innerDepthMm, b.innerHeightMm),
    current: quantity(b.onHandQty),
    safety: quantity(b.safetyQty),
    level: b.stockLevelPct,
    daysLeft: b.daysToStockout == null ? '—' : `${b.daysToStockout}일`,
    statusLabel: STOCK[b.status],
    supplier: b.supplier?.name ?? '미지정',
    leadTimeDays: b.supplier?.leadTimeDays ?? null,
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
