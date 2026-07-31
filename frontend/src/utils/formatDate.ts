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

// ISO 8601 주차(월요일 시작, 1월 4일이 포함된 주가 1주차).
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // 목요일로 옮기면 그 주가 속한 해가 결정된다 (일요일 0 → 7로 보정)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}
