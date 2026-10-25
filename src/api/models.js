// 상세 화면 하나가 통째로 쓰는 화면 모델입니다. 표 행(rows.js)보다 구조가 깊고 화면 구성에 맞춰져 있습니다.
import { ORDER, currency, date, dimensions, number, person, quantity, time } from './format'

export function orderDetail(o) {
  return {
    id: o.id,
    number: o.poNo,
    status: o.status,
    statusLabel: ORDER[o.status],
    // 단계에서 '배송 중'을 뺐으므로, 배송 중 발주서는 직전 단계(승인 완료)에 머문 것으로 표시합니다.
    currentStepIndex: { PENDING: 1, APPROVED: 2, IN_TRANSIT: 2, RECEIVED: 3 }[o.status] ?? 0,
    caption: o.proposalGeneratedAt ? `제안서 생성 ${time(o.proposalGeneratedAt)}` : '',
    info: [
      ['ordered-at', '발주일', date(o.createdAt)],
      ['supplier', '공급사', o.supplier?.name ?? '미지정'],
      ['delivery-at', '납품 예정일', date(o.deliveryDate)],
      ['requester', '요청자', person(o.requester)],
      ['approver', '승인자', person(o.approver)],
      ['payment', '결제 조건', o.supplier?.paymentTerms ?? '—'],
    ].map(([id, label, value]) => ({ id, label, value })),
    items: o.items.map((i) => ({
      id: i.boxSpec.id,
      code: i.boxSpec.code,
      size: dimensions(i.boxSpec.innerWidthMm, i.boxSpec.innerDepthMm, i.boxSpec.innerHeightMm, false),
      quantity: quantity(i.qty),
      unitPrice: currency(i.unitPriceKrw),
      amount: currency(i.amountKrw),
    })),
    totalQuantity: `총 수량 ${quantity(o.totalQty)}`,
    totalAmount: currency(o.totalAmountKrw),
  }
}

// 박스 주문: 최신 제안서. 관측 기반 참고 계산(OBSERVATION_BASELINE)은 실제 소모량 예측으로 표시하지 않는다.
export function proposalModel(p) {
  if (!p) return null
  const analysis = p.analysis ?? {}
  if (analysis.clientView) return agentProposalModel(p, analysis.clientView)
  const baseline = analysis.method === 'OBSERVATION_BASELINE'
  const ordered = p.items.filter((i) => i.proposedQty > 0)
  const month = Number(p.targetMonth.split('-')[1])
  return {
    id: p.id,
    baseline,
    totalQty: p.totalQty,
    createdAt: `생성 ${time(p.generatedAt)}`,
    headline: ordered.length
      ? `${month}월 참고 소모 ${quantity(p.forecastUsageQty)} 기준, ${ordered.length}개 규격 총 ${quantity(p.totalQty)} 주문을 제안합니다.`
      : `${month}월 참고 소모 ${quantity(p.forecastUsageQty)} 기준, 현재 재고로 충분해 주문할 규격이 없습니다.`,
    subline: baseline
      ? `최근 ${number(analysis.lookbackDays)}일 성공 관측 ${number(analysis.sampleCount)}건 기준 참고 계산 · 규격별 안전 재고 반영`
      : '규격별 안전 재고 반영',
    rows: p.items.map((i) => ({
      id: i.boxSpec.id,
      code: i.boxSpec.code,
      current: number(i.onHandQty),
      expected: number(i.forecastUsageQty),
      safety: number(i.safetyQty),
      suggested: quantity(i.proposedQty),
    })),
    rationale: [
      ...(analysis.insights ?? []),
      ...(baseline
        ? [`제안 수량 = 참고 소모 + 안전 재고 − 현재 재고 (${number(analysis.orderUnit)}개 단위 올림)`]
        : []),
    ],
    totalAmount: currency(p.totalAmountKrw),
  }
}
// AI 에이전트 제안서: 에이전트가 저장한 화면용 요약(clientView)을 그대로 쓴다. 신규 규격 줄은 아직 규격이 없어
// 품목(items)에 없으므로 표·합계는 clientView 기준이다.
function agentProposalModel(p, view) {
  return {
    id: p.id,
    baseline: false,
    agent: true,
    totalQty: p.totalQty,
    createdAt: `생성 ${time(p.generatedAt)}`,
    headline: view.headline,
    subline: view.subline,
    rows: view.rows.map((r) => ({ ...r, code: r.isNew ? `${r.code.replace(/^N-/, '')} (신규)` : r.code })),
    rationale: view.rationale ?? [],
    totalAmount: view.totalAmount,
    effect: view.newSpecEffect?.rows?.length ? view.newSpecEffect : null,
    sources: view.sources ?? [],
  }
}

// 전월·전년 비교는 비용 예측에 근거가 저장된 경우에만 보여 준다.
export function costComparisons(cost) {
  const signed = (value, text) => `${value < 0 ? '−' : '+'}${text}`
  return [
    ['prev-month', '전월 대비', cost?.forecast?.previousMonth],
    ['prev-year', '전년 동월 대비', cost?.forecast?.previousYear],
  ]
    .filter(([, , c]) => c?.changePct != null && c.changeAmountKrw != null)
    .map(([id, label, c]) => ({
      id,
      label: `${label} · ${c.baseMonth.replace('-', '.')} 발주 ${currency(c.baseAmountKrw)}`,
      change: `${c.changePct < 0 ? '▼' : '▲'} ${signed(c.changePct, `${Math.abs(c.changePct)}%`)}  (${signed(c.changeAmountKrw, currency(Math.abs(c.changeAmountKrw)))})`,
    }))
}
// 박스 주문: 공급사별 발주서 초안. quantity·deliveryDate는 화면에서 고치는 값, saved*는 서버 저장값이다.
export function draftModel(o) {
  return {
    id: o.id,
    poNo: o.poNo,
    version: o.version,
    status: o.status,
    statusLabel: ORDER[o.status] ?? o.status,
    supplierName: o.supplier?.name ?? '미지정',
    savedDeliveryDate: o.deliveryDate ?? '',
    deliveryDate: o.deliveryDate ?? '',
    info: [
      ['supplier', '공급사', o.supplier?.name ?? '미지정'],
      ['due-date', '납품 희망일', date(o.deliveryDate)],
      ['requester', '요청자', person(o.requester)],
      ['approver', '승인자', o.approver ? person(o.approver) : '승인할 때 기록돼요'],
      ['destination', '납품처', o.recipient?.name ?? '—'],
      ['address', '납품 주소', o.recipient?.address ?? '—'],
      ['receiver', '수령 담당자', o.recipient?.receivingContact ?? '—'],
      ['hours', '입고 가능 시간', o.recipient?.receivingHours ?? '—'],
    ].map(([id, label, value]) => ({ id, label, value })),
    items: o.items.map((i) => ({
      id: i.boxSpec.id,
      code: i.boxSpec.code,
      size: dimensions(i.boxSpec.innerWidthMm, i.boxSpec.innerDepthMm, i.boxSpec.innerHeightMm, false),
      savedQty: i.qty ?? 0,
      quantity: i.qty ?? 0,
      unitPrice: i.unitPriceKrw ?? 0,
    })),
  }
}

export function dashboardModel(data) {
  const inventory = data?.inventory
  const proposal = data?.demandForecast?.proposal?.result
  const currentCost = data?.currentMonthCost?.result?.forecast
  const targetCost = data?.targetMonthCost?.result?.forecast
  const tones = { S: 'gold', M: 'brown', L: 'sand' }
  const label = (size) => ({ S: 'S (소형)', M: 'M (중형)', L: 'L (대형)' })[size] ?? size
  return {
    forecast: {
      period: data?.targetMonth ?? '다음 달',
      basis: proposal ? '관측 기반 참고 계산' : '아직 생성된 계산 결과가 없어요.',
      total: quantity(data?.demandForecast?.totalForecastUsageQty),
      comparison: '',
      change: '',
      breakdown: (data?.demandForecast?.bySize ?? []).map((b) => ({
        id: b.sizeClass,
        label: label(b.sizeClass),
        quantity: quantity(b.forecastUsageQty),
        ratio: b.sharePct ?? 0,
        tone: tones[b.sizeClass] ?? 'sand',
      })),
      insights: proposal?.analysis?.insights ?? ['분석 결과가 생성되면 안내를 확인할 수 있어요.'],
    },
    inventorySummary: {
      asOf: inventory?.lastUpdatedAt ? `기준 ${time(inventory.lastUpdatedAt)}` : '갱신 시각 없음',
      current: {
        label: '현재 재고',
        value: quantity(inventory?.totalOnHandQty),
        hint: `${number(inventory?.activeSpecCount)}개 규격`,
      },
      next: {
        label: '다음 달 예상 재고',
        value: quantity(data?.projectedStockQty),
        hint: '제안 수량과 참고 수량 기준',
      },
      shortageNote: `부족 ${number(inventory?.shortageSpecCount)}개 규격`,
      bySize: (data?.stockBySize ?? []).map((b) => ({
        id: b.sizeClass,
        label: label(b.sizeClass),
        quantity: quantity(b.onHandQty),
        ratio: b.onHandQty ?? 0,
        tone: tones[b.sizeClass] ?? 'sand',
      })),
    },
    costSummary: {
      note: 'VAT 별도',
      items: [
        {
          id: 'packing-cost',
          label: '이번 달 참고 포장비용',
          value: currency(currentCost?.packagingCostKrw),
          hint: '저장된 참고 계산 기준',
        },
        {
          id: 'monthly-saving',
          label: '월 포장비 절감액',
          value: currency(currentCost?.packagingSavingsKrw),
          hint: currentCost?.packagingSavingsKrw == null ? '산출 근거가 아직 없어요.' : '',
        },
        {
          id: 'next-order',
          label: '다음 달 박스 발주 예정',
          value: currency(targetCost?.purchaseCostKrw),
          hint: quantity(proposal?.totalQty),
        },
      ],
    },
    safetyStockAlerts: {
      count: `${number(inventory?.shortageSpecCount)}개 규격`,
      items: (data?.shortages ?? []).map((b) => ({
        id: b.boxSpecId,
        code: b.code,
        name: b.name,
        shortage: `${quantity(b.shortageQty)} 부족`,
        detail: `현재 ${quantity(b.onHandQty)} / 안전 재고 ${quantity(b.safetyQty)}`,
        ratio: b.safetyQty > 0 ? Math.min(100, Math.round((b.onHandQty / b.safetyQty) * 100)) : 0,
      })),
    },
  }
}
