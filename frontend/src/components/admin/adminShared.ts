/*
 * 관리자 화면에서 하위 컴포넌트가 함께 쓰는 상수·형식 함수.
 *
 * Admin.tsx가 2000줄을 넘겨 하위 컴포넌트(임시 비밀번호 모달, 일괄 등록 모달,
 * 로그 행, 닉네임 편집)를 pages/ 밖으로 꺼냈다. 그 과정에서 상수·헬퍼도 이 파일로
 * 옮겨 Admin.tsx와 새 파일이 같은 값을 쓰도록 했다. 값이 두 벌로 나뉘면 라벨이나
 * 색이 여기저기서 어긋난다.
 */

// APPROVED는 정상 상태라 배지를 달지 않는다(undefined면 렌더하지 않음)
export const USER_STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  PENDING: { label: '승인 대기', tone: 'fl-tone-warn' },
  REJECTED: { label: '거절됨', tone: 'fl-tone-danger' },
  WITHDRAW_REQUESTED: { label: '탈퇴 신청', tone: 'fl-tone-warn' },
  WITHDRAWN: { label: '탈퇴', tone: 'fl-tone-danger' },
}

export const OVERTIME_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

export const OVERTIME_STATUS_TONE: Record<string, string> = {
  PENDING: 'fl-tone-warn',
  APPROVED: 'fl-tone-success',
  REJECTED: 'fl-tone-danger',
}

export const OVERTIME_TYPE_LABEL: Record<string, string> = { OVERTIME: '잔업', SPECIAL: '특근' }

export const LOG_ACTION_TONE: Record<string, string> = {
  CREATE: 'fl-tone-success',
  UPDATE: 'fl-tone-warn',
  DELETE: 'fl-tone-danger',
}

export const LOG_ENTITY_OPTIONS = [
  { value: '', label: '모든 엔티티' },
  { value: 'TODO', label: '할일' },
  { value: 'CALENDAR_EVENT', label: '일정' },
  { value: 'NOTICE', label: '공지사항' },
  { value: 'NOTICE_COMMENT', label: '댓글' },
  { value: 'SCENARIO', label: '적재 시뮬레이션' },
  { value: 'OVERTIME_RECORD', label: '잔업/특근' },
  { value: 'USER', label: '사용자 계정' },
  { value: 'AUTH', label: '인증(로그인/비밀번호)' },
  // 이전 기능이라 이제는 새 값이 들어오지 않는다. 그래도 선택지에 남겨 두는 이유는
  // 서버의 EntityTypeConverter와 같다 — 이걸 몰라도 로그 목록이 통째로 깨지지 않는다.
  { value: 'PROGRESS', label: '진행상황(이전 기능)' },
]

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-08-14' → '08.14 (금)' */
export function formatWorkDate(ymd: string): string {
  const [y, m, d] = (ymd || '').split('-').map(Number)
  if (!y || !m || !d) return ymd
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

export interface AdminLog {
  id: number
  timestamp: string
  adminUsername: string
  action: string
  entityType: string
  entityId: number | null
  details: string | null
  ipAddress: string | null
}