// 본부 리포트의 입력 데이터는 일별 출고 집계로 계산해 DB에 저장한 월별 성과다.
// 월 효과는 리포트와 동일하게 30일로 환산하고, 누적은 실제 기간 합계를 유지한다.
export const STATUS = {
  ok: { label: '양호', reason: '저장된 리포트에서 목표 달성으로 판정', tone: 'success' },
  warn: { label: '주의', reason: '저장된 리포트에서 개선 중으로 판정', tone: 'warning' },
  bad: { label: '개선 필요', reason: '저장된 리포트에서 추가 개선이 필요한 것으로 판정', tone: 'danger' },
  unknown: { label: '판정 없음', reason: '저장된 판정이 없습니다.', tone: 'neutral' },
}
const statusKey = { 양호: 'ok', 주의: 'warn', '개선 필요': 'bad' }
const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const total = (rows, key) => rows.reduce((sum, row) => sum + (row[key] ?? 0), 0)
const daysIn = (month) => new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).getUTCDate()
const actual = (row, key, original) => num(row[original]) ?? num(row[key]) ?? 0

export function buildHqDashboard(reports) {
  const sorted = [...reports].sort((a, b) => a.month.localeCompare(b.month))
  const months = sorted.map((report) => report.month)
  const histories = new Map()
  const centersByMonth = sorted.map((report, index) => {
    if (!Array.isArray(report.data)) throw new Error(`${report.month} 리포트에 센터별 성과 데이터가 없습니다.`)
    return report.data
      .filter((row) => row.warehouseId)
      .map((row) => {
        const ship = num(row.ship) ?? 0
        const days = num(row.days) > 0 ? row.days : daysIn(report.month)
        const savingActual = actual(row, 'saving', 'saving_act')
        const carbonActual = actual(row, 'co2_cut', 'co2_act')
        const last = histories.get(row.warehouseId)?.at(-1)
        const previous = last?.month === sorted[index - 1]?.month ? last : null
        const saving = Math.round((savingActual / days) * 30)
        const carbon = (carbonActual / days) * 30
        const ship30 = (ship / days) * 30
        const value = {
          warehouseId: row.warehouseId,
          name: row.center,
          month: report.month,
          status: statusKey[row.status] ?? 'unknown',
          shipments: ship,
          fill: num(row.fill),
          base: num(row.fill_b),
          target: num(row.fill_target_pct) ?? num(row.target_pct),
          saving,
          carbon,
          savingActual,
          carbonActual,
          monthSaving:
            previous?.shipments > 0 && ship > 0
              ? Math.round(saving - (previous.savingActual / previous.shipments) * ship30)
              : saving,
          rerun: row.rerun ?? null,
          action: row.action ?? null,
          improvements: { month: num(row.applied) ?? 0, total: num(row.applied_cum) ?? 0 },
          dataAsOf: row.dataAsOf ?? null,
        }
        if (!histories.has(row.warehouseId)) histories.set(row.warehouseId, [])
        histories.get(row.warehouseId).push(value)
        return value
      })
  })
  const latest = centersByMonth.at(-1) ?? []
  const centerReports = latest.map((row) => {
    const history = histories.get(row.warehouseId)
    const previous = history.find((r) => r.month === months.at(-2))
    return {
      ...row,
      cumulativeSaving: total(history, 'savingActual'),
      cumulativeCarbonKg: total(history, 'carbonActual'),
      fills: months.map((month) => history.find((r) => r.month === month)?.fill ?? null),
      fillDelta: previous?.fill != null && row.fill != null ? row.fill - previous.fill : null,
    }
  })
  const all = centersByMonth.flat()
  const weight = total(latest, 'shipments')
  const weightedFill = (key) => {
    const measured = latest.filter((row) => row[key] != null && row.shipments > 0)
    const n = total(measured, 'shipments')
    return n ? measured.reduce((sum, row) => sum + row[key] * row.shipments, 0) / n : null
  }
  const monthlySaving = total(latest, 'saving')
  const reruns = centerReports
    .filter((row) => row.rerun)
    .map((row) => ({
      warehouseId: row.warehouseId,
      center: row.name,
      status: row.status,
      before: num(row.rerun.fill_before),
      after: num(row.rerun.fill_after),
      added: Array.isArray(row.rerun.new) ? row.rerun.new.length : 0,
      saving: num(row.rerun.saving_change),
    }))
  return {
    centerReports,
    reruns,
    months: months.map((month) => `${Number(month.slice(5))}월`),
    summary: {
      month: months.at(-1) ?? null,
      period: months.length ? `${months[0]} ~ ${months.at(-1)}` : '—',
      monthSaving: total(latest, 'monthSaving'),
      monthlySaving,
      annualSaving: (monthlySaving / 30) * 365,
      cumulativeSaving: total(all, 'savingActual'),
      cumulativeCarbonKg: total(all, 'carbonActual'),
      fillRate: { from: weight ? weightedFill('base') : null, to: weight ? weightedFill('fill') : null },
      counts: Object.fromEntries(
        Object.keys(STATUS).map((key) => [key, latest.filter((r) => r.status === key).length]),
      ),
      generatedAt: sorted.at(-1)?.generatedAt ?? null,
    },
  }
}
