import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHqDashboard } from '../src/views/admin/hqReportData.js'

const row = (overrides = {}) => ({
  warehouseId: 'one',
  center: '판교 센터',
  ship: 100,
  saving: 300,
  co2_cut: 30,
  fill_b: 20,
  fill: 40,
  status: '주의',
  applied: 1,
  applied_cum: 1,
  ...overrides,
})
const report = (month, rows) => ({ month, data: rows })

test('empty reports produce an explicit empty dashboard', () => {
  const result = buildHqDashboard([])
  assert.equal(result.summary.month, null)
  assert.deepEqual(result.centerReports, [])
})
test('monthly effects normalize days but cumulative effects keep actual totals', () => {
  const result = buildHqDashboard([
    report('2026-05', [row({ days: 30, saving: 300, ship: 100 })]),
    report('2026-06', [row({ days: 15, saving: 300, ship: 100, fill: 45 })]),
  ])
  assert.equal(result.summary.monthlySaving, 600)
  assert.equal(result.summary.cumulativeSaving, 600)
  assert.equal(result.summary.monthSaving, 0) // 출고당 절감 3원은 그대로다.
  assert.equal(result.summary.cumulativeCarbonKg, 60)
  assert.equal(result.centerReports[0].fillDelta, 5)
})
test('new savings compare per-shipment efficiency instead of shipment volume', () => {
  const result = buildHqDashboard([
    report('2026-05', [row({ days: 30 })]),
    report('2026-06', [row({ ship: 200, saving: 800, days: 30 })]),
  ])
  assert.equal(result.summary.monthSaving, 200)
  assert.equal(result.summary.annualSaving, (800 / 30) * 365)
})
test('center identity uses IDs despite duplicate or changed names; fill uses shipment weights', () => {
  const result = buildHqDashboard([
    report('2026-09', [
      row({ warehouseId: 'one', center: '같은 이름', ship: 100, fill: 20 }),
      row({ warehouseId: 'two', center: '같은 이름', ship: 300, fill: 60, status: '양호' }),
    ]),
  ])
  assert.equal(result.centerReports.length, 2)
  assert.equal(result.summary.fillRate.to, 50)
  assert.equal(result.summary.counts.ok, 1)
  assert.equal(result.summary.counts.warn, 1)
})
test('missing months and missing targets stay unknown; declines keep a negative delta', () => {
  const result = buildHqDashboard([
    report('2026-05', [row()]),
    report('2026-06', []),
    report('2026-07', [row({ fill: 30 })]),
    report('2026-08', [row({ fill: 25 })]),
  ])
  assert.deepEqual(result.centerReports[0].fills, [40, null, 30, 25])
  assert.equal(result.centerReports[0].fillDelta, -5)
  assert.equal(result.centerReports[0].target, null)
})
test('report dates are sorted and rerun details come only from saved records', () => {
  const result = buildHqDashboard([
    report('2026-10', [row({ rerun: { fill_before: 35, fill_after: 40, new: ['B'], saving_change: -50 } })]),
    report('2026-09', [row()]),
  ])
  assert.equal(result.summary.month, '2026-10')
  assert.deepEqual(result.months, ['9월', '10월'])
  assert.equal(result.reruns[0].saving, -50)
  assert.equal(result.reruns[0].warehouseId, 'one')
})
test('file-only legacy reports do not silently become zero-valued live data', () => {
  assert.throws(() => buildHqDashboard([{ month: '2026-10', data: null }]), /센터별 성과/)
})
