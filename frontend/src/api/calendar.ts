import { apiFetch } from './client'
import { getUsername, isAdmin } from '../auth/token'

/** COMPANY: 전 직원이 보는 사내 일정 / PRIVATE: 등록한 본인만 보는 개인 일정 */
export type CalendarScope = 'COMPANY' | 'PRIVATE'

export type CalendarEvent = {
  id: number
  date: string
  time?: string
  title: string
  scope: CalendarScope
  createdByUsername?: string
  createdByDisplayName?: string
}

export type CalendarEventInput = {
  date: string
  time?: string
  title: string
  scope: CalendarScope
}

/**
 * 수정·삭제 버튼을 보여줄지 판단한다. 서버(CalendarEventController.canModify)와
 * 같은 규칙이며, 실제 권한은 서버가 막는다. 여기서는 화면 표시용으로만 쓴다.
 */
export function canEditEvent(event: CalendarEvent): boolean {
  const me = getUsername()
  if (!me) return false
  if (event.createdByUsername === me) return true
  return event.scope !== 'PRIVATE' && isAdmin()
}

export async function listEvents(start: string, end: string): Promise<CalendarEvent[]> {
  return apiFetch(`/api/calendar?start=${start}&end=${end}`)
}

export async function createEvent(data: CalendarEventInput): Promise<CalendarEvent> {
  return apiFetch(`/api/calendar`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateEvent(id: number, data: CalendarEventInput): Promise<CalendarEvent> {
  return apiFetch(`/api/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteEvent(id: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/calendar/${id}`, { method: 'DELETE' })
}
