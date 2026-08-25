import { apiFetch, apiFetchBlob } from './client'

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

export interface OvertimeBulkInput extends OvertimeRecordInput {
  userIds: number[]
  /** 생략하면 서버가 바로 승인 처리한다. false면 승인 대기 상태로 들어간다. */
  approveNow?: boolean
}

/** 일괄 등록에서 제외된 직원 한 명 */
export interface OvertimeBulkSkip {
  name: string
  reason: string
}

export interface OvertimeBulkResult {
  created: number
  records: OvertimeRecord[]
  skipped: OvertimeBulkSkip[]
}

/** 관리자 전용. 선택한 직원 전원에게 같은 근무 조건으로 한 건씩 등록한다. */
export async function createOvertimeRecordsBulk(data: OvertimeBulkInput): Promise<OvertimeBulkResult> {
  return apiFetch('/api/overtime-records/bulk', { method: 'POST', body: JSON.stringify(data) })
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
  /** 급여 정산 주기 시작일(1~28). 엑셀 내보내기 기본 기간을 채우는 데 쓴다. */
  payrollStartDay: number
}

/** 지정한 기간의 잔업/특근 엑셀(.xlsx). 상세 내역·기간 집계 두 시트가 들어 있다. */
export async function downloadOvertimeExcel(from: string, to: string): Promise<Blob> {
  return apiFetchBlob(`/api/overtime-records/export?from=${from}&to=${to}`)
}

export async function getOvertimeDefaults(): Promise<OvertimeDefaults> {
  return apiFetch('/api/overtime-records/defaults')
}

export async function updateOvertimeDefaults(data: OvertimeDefaults): Promise<OvertimeDefaults> {
  return apiFetch('/api/overtime-records/defaults', { method: 'PUT', body: JSON.stringify(data) })
}
