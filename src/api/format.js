// 숫자·금액·날짜를 화면 문구로 바꾸는 표시 전용 유틸입니다. 값이 없으면 '—'로 통일합니다.
export const number = (value) => (value == null ? '—' : Number(value).toLocaleString('ko-KR'))
export const quantity = (value) => (value == null ? '—' : `${number(value)}개`)
export const currency = (value) => (value == null ? '—' : `₩${number(value)}`)
export const dimensions = (w, d, h, unit = true) =>
  [w, d, h].some((v) => v == null) ? '—' : `${w} × ${d} × ${h}${unit ? ' mm' : ''}`
export const date = (value) =>
  value ? (value.length === 10 ? value : localDate(new Date(value))).replaceAll('-', '.') : '—'
export const time = (value) =>
  value
    ? new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '기준 시각 없음'
export function localDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}
export function nextMonth() {
  const [year, month] = localDate().split('-').map(Number)
  return `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}`
}
/** 'YYYY-MM' → '2026.11.01 – 11.30' */
export function monthPeriod(month) {
  const [year, mon] = month.split('-').map(Number)
  const mm = String(mon).padStart(2, '0')
  return `${year}.${mm}.01 – ${mm}.${new Date(Date.UTC(year, mon, 0)).getUTCDate()}`
}
export const person = (p) => (p ? [p.name, p.jobTitle, p.department].filter(Boolean).join(' · ') : '—')

/** 포장공간비율 색: 85% 이상 정상(파랑) · 70% 이상 주의(노랑) · 그 아래 부적합(빨강) */
export const fillTone = (value) => (value >= 85 ? 'info' : value >= 70 ? 'warning' : 'danger')

// 서버 코드 → 화면 라벨. 비교·분기는 서버 코드로 하고, 이 라벨은 표시에만 씁니다.
export const MATCH = { MATCHED: '매칭 완료', REVIEW: '검토 필요', UNMATCHED: '미매칭' }
export const STOCK = { SUFFICIENT: '충분', CAUTION: '주의', SHORTAGE: '부족', UNKNOWN: '미확인' }
export const ORDER = {
  PENDING: '승인 대기',
  APPROVED: '승인 완료',
  IN_TRANSIT: '배송 중',
  RECEIVED: '입고 완료',
  REJECTED: '반려',
}
export const JOB = {
  PENDING: '계산 대기',
  RUNNING: '계산 중',
  SUCCEEDED: '계산 완료',
  FAILED: '계산 실패',
  PUBLISH_FAILED: '계산 실패',
  TIMED_OUT: '시간 초과',
}
