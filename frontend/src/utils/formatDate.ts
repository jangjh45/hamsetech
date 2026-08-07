export function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export function formatDateTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

// 로컬 타임존 기준 YYYY-MM-DD. 서버 API가 쓰는 날짜 포맷.
export function toYmd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 서버는 LocalTime을 "HH:mm" 또는 "HH:mm:ss"로 내려준다. 화면에는 초를 빼고 보여준다.
export function formatTime(time?: string | null): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  if (h === undefined || m === undefined) return time
  return `${h.padStart(2, '0')}:${m}`
}

// 분을 "N시간 M분"으로. 홈 위젯과 프로필 요약이 같은 표기를 쓴다.
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

/**
 * 오늘이 속한 급여 정산 주기를 YYYY-MM-DD 두 개로 돌려준다.
 * 정산 기간이 달력 월과 어긋나는 회사를 위해 주기 시작일(1~28)을 받는다.
 *
 * 예) startDay=15, 오늘 2026-08-08 → 2026-07-15 ~ 2026-08-14 (아직 이번 주기가 시작 전)
 *     startDay=15, 오늘 2026-08-20 → 2026-08-15 ~ 2026-09-14
 *     startDay=1,  오늘 2026-08-08 → 2026-08-01 ~ 2026-08-31 (달력 월과 동일)
 *     startDay=15, 오늘 2026-01-05 → 2025-12-15 ~ 2026-01-14 (연말을 넘어가도 Date가 알아서 보정)
 */
export function payrollCycle(startDay: number, today: Date = new Date()): { from: string; to: string } {
  const day = Math.min(Math.max(Math.trunc(startDay) || 1, 1), 28)
  // 오늘이 시작일 전이면 아직 지난달에 시작한 주기 안에 있다.
  const startMonthOffset = today.getDate() >= day ? 0 : -1
  const from = new Date(today.getFullYear(), today.getMonth() + startMonthOffset, day)
  // 다음 주기 시작일의 하루 전. day=1이면 자연히 그 달의 말일이 된다.
  const to = new Date(from.getFullYear(), from.getMonth() + 1, day - 1)
  return { from: toYmd(from), to: toYmd(to) }
}

// ISO 8601 주차(월요일 시작, 1월 4일이 포함된 주가 1주차).
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // 목요일로 옮기면 그 주가 속한 해가 결정된다 (일요일 0 → 7로 보정)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
