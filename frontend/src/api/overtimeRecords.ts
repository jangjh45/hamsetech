import { apiFetch } from './client'

export type OvertimeType = 'OVERTIME' | 'SPECIAL'
export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface OvertimeRecord {
  id: number
  userId: number
  username: string
  displayName?: string
  workDate: string
  type: OvertimeType
  startTime: string | null
  endTime: string | null
  totalMinutes: number
  reason: string | null
  status: OvertimeStatus
  rejectReason: string | null
  approverUsername: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export interface OvertimeSummary {
  username: string
  displayName?: string
  overtimeMinutes: number
  specialMinutes: number
  overtimeDays: number
  specialDays: number
}

export interface OvertimeRecordInput {
  workDate: string
  type: OvertimeType
  startTime?: string | null
  endTime?: string | null
  totalMinutes?: number | null
  reason?: string
}

export async function createOvertimeRecord(data: OvertimeRecordInput): Promise<OvertimeRecord> {
  return apiFetch('/api/overtime-records', { method: 'POST', body: JSON.stringify(data) })
}

export async function listMyOvertimeRecords(from?: string, to?: string): Promise<OvertimeRecord[]> {
  const params = new URLSearchParams()
  if (from) params.set('from', from)
  if (to) params.set('to', to)
  const qs = params.toString()
  return apiFetch(`/api/overtime-records/me${qs ? `?${qs}` : ''}`)
}

export async function updateOvertimeRecord(id: number, data: OvertimeRecordInput): Promise<OvertimeRecord> {
  return apiFetch(`/api/overtime-records/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteOvertimeRecord(id: number): Promise<void> {
  return apiFetch(`/api/overtime-records/${id}`, { method: 'DELETE' })
}

export interface OvertimeListFilters {
  username?: string
  type?: OvertimeType
  status?: OvertimeStatus
  from?: string
  to?: string
  page?: number
  size?: number
}

export async function listAllOvertimeRecords(filters: OvertimeListFilters = {}): Promise<Page<OvertimeRecord>> {
  const params = new URLSearchParams()
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  })
  return apiFetch(`/api/overtime-records?${params.toString()}`)
}

export async function approveOvertimeRecord(id: number): Promise<OvertimeRecord> {
  return apiFetch(`/api/overtime-records/${id}/approve`, { method: 'PUT' })
}

export async function rejectOvertimeRecord(id: number, reason: string): Promise<OvertimeRecord> {
  return apiFetch(`/api/overtime-records/${id}/reject`, { method: 'PUT', body: JSON.stringify({ reason }) })
}

export async function getOvertimeSummary(month: string): Promise<OvertimeSummary[]> {
  return apiFetch(`/api/overtime-records/summary?month=${month}`)
}

export interface OvertimeDefaults {
  overtimeStart: string
  overtimeEnd: string
  specialStart: string
  specialEnd: string
}

export async function getOvertimeDefaults(): Promise<OvertimeDefaults> {
  return apiFetch('/api/overtime-records/defaults')
}

export async function updateOvertimeDefaults(data: OvertimeDefaults): Promise<OvertimeDefaults> {
  return apiFetch('/api/overtime-records/defaults', { method: 'PUT', body: JSON.stringify(data) })
}
