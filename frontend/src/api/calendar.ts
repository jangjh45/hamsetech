import { apiFetch } from './client'

export type CalendarEvent = { id: number; date: string; time?: string; title: string }

export async function listEvents(start: string, end: string): Promise<CalendarEvent[]> {
  return apiFetch(`/api/calendar?start=${start}&end=${end}`)
}

export async function createEvent(data: { date: string; time?: string; title: string }): Promise<CalendarEvent> {
  return apiFetch(`/api/calendar`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateEvent(id: number, data: { date: string; time?: string; title: string }): Promise<CalendarEvent> {
  return apiFetch(`/api/calendar/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteEvent(id: number): Promise<{ deleted: boolean }> {
  return apiFetch(`/api/calendar/${id}`, { method: 'DELETE' })
}


