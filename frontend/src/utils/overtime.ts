import type { OvertimeDefaults, OvertimeType } from '../api/overtimeRecords'
import { formatTime } from './formatDate'

/**
 * 잔업/특근 근무시간 계산. 서버 OvertimeRecordService.resolveTotalMinutes와 같은 규칙이어야
 * 저장 전 미리보기가 실제 저장값과 맞는다. 직원 등록 폼과 관리자 일괄 등록 폼이 함께 쓴다.
 */

/** 특근 시 점심 휴게시간(분)과 이를 적용할 최소 근무시간 */
const LUNCH_BREAK_MINUTES = 60
const LUNCH_DEDUCTION_THRESHOLD_MINUTES = 6 * 60

/** 저녁 휴게 구간(자정 기준 분). 구분과 무관하게 겹친 만큼 차감된다. */
const DINNER_BREAK_START_MIN = 17 * 60
const DINNER_BREAK_END_MIN = 17 * 60 + 30
const MINUTES_PER_DAY = 24 * 60

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart))
}

/** 휴게시간을 뺀 실제 근무시간(분). 시간이 비었거나 형식이 틀리면 null. */
export function durationOf(type: OvertimeType, start: string, end: string): number | null {
  if (!start || !end) return null
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null

  // 휴게 차감은 차감 전 경과 시간(gross) 기준의 시간대로 계산한다.
  const workStart = sh * 60 + sm
  let gross = eh * 60 + em - workStart
  if (gross < 0) gross += MINUTES_PER_DAY
  const workEnd = workStart + gross

  let net = gross
  if (type === 'SPECIAL' && gross >= LUNCH_DEDUCTION_THRESHOLD_MINUTES) {
    net -= LUNCH_BREAK_MINUTES
  }
  // 자정을 넘긴 근무는 다음 날 저녁 구간과도 겹칠 수 있어 이틀치를 모두 확인한다.
  net -= overlapMinutes(workStart, workEnd, DINNER_BREAK_START_MIN, DINNER_BREAK_END_MIN)
  net -= overlapMinutes(
    workStart,
    workEnd,
    DINNER_BREAK_START_MIN + MINUTES_PER_DAY,
    DINNER_BREAK_END_MIN + MINUTES_PER_DAY,
  )
  return Math.max(0, net)
}

/** 구분에 맞는 기본 시작·종료 시간. 설정을 아직 못 읽었으면 빈 값을 준다. */
export function defaultTimesFor(type: OvertimeType, defaults: OvertimeDefaults | null): [string, string] {
  if (!defaults) return ['', '']
  return type === 'SPECIAL'
    ? [formatTime(defaults.specialStart), formatTime(defaults.specialEnd)]
    : [formatTime(defaults.overtimeStart), formatTime(defaults.overtimeEnd)]
}
