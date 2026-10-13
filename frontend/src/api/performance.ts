import { apiFetch } from './client'

export type PerformanceSnapshot = {
  capturedAt: string
  requestsLast5Seconds: number
  requestsLast60Seconds: number
  serverErrorsLast60Seconds: number
  requestsPerSecond: number
  errorRatePercent: number
  averageLatencyMs: number | null
  p50LatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
  jvmHeapUsedBytes: number | null
  jvmHeapMaxBytes: number | null
  dbConnectionsActive: number | null
  dbConnectionsIdle: number | null
  dbConnectionsPending: number | null
  dbConnectionsMax: number | null
  jvmNonHeapUsedBytes: number | null
  jvmNonHeapMaxBytes: number | null
  processCpuPercent: number | null
  systemCpuPercent: number | null
  containerMemoryUsedBytes: number | null
  containerMemoryMaxBytes: number | null
  systemMemoryUsedBytes: number | null
  systemMemoryTotalBytes: number | null
  uploadStorageUsableBytes: number | null
  uploadStorageTotalBytes: number | null
}

export type ApiPerformanceMetric = {
  method: string
  path: string
  requests: number
  serverErrors: number
  errorRatePercent: number
  averageLatencyMs: number | null
  p95LatencyMs: number | null
  p99LatencyMs: number | null
}

export type PerformanceEndpointSort = 'p95' | 'errors' | 'requests'

export type PerformanceThresholds = {
  p95LatencyMs: number
  errorRatePercent: number
  heapUsedPercent: number
  dbPoolUsedPercent: number
  containerMemoryUsedPercent: number
  systemCpuPercent: number
  systemMemoryUsedPercent: number
  uploadStorageFreePercent: number
}

export type PerformanceAlertEvent = {
  id: number
  alertKey: string
  eventType: 'TRIGGERED' | 'RESOLVED'
  message: string
  observedValue: number
  thresholdValue: number | null
  unit: string
  occurredAt: string
}

export type PerformanceDashboardSnapshot = {
  current: PerformanceSnapshot
  endpoints: ApiPerformanceMetric[]
  thresholds: PerformanceThresholds
}

export type PerformanceHistoryPoint = {
  capturedAt: string
  requestsPerSecond: number
  errorRatePercent: number
  p95LatencyMs: number | null
  jvmHeapUsedBytes: number | null
  jvmHeapMaxBytes: number | null
  dbConnectionsActive: number | null
  dbConnectionsMax: number | null
  systemCpuPercent: number | null
  containerMemoryUsedBytes: number | null
  containerMemoryMaxBytes: number | null
  systemMemoryUsedBytes: number | null
  systemMemoryTotalBytes: number | null
}

export type PerformanceHistory = {
  range: '5m' | '1h' | '24h'
  capturedAt: string
  oldestAvailable: string | null
  retentionDays: number
  points: PerformanceHistoryPoint[]
}

export function getPerformanceSnapshot(): Promise<PerformanceDashboardSnapshot> {
  return apiFetch('/api/admin/performance')
}

export function getPerformanceHistory(range: PerformanceHistory['range']): Promise<PerformanceHistory> {
  return apiFetch(`/api/admin/performance/history?range=${range}`)
}

export function getPerformanceEndpoints(
  range: PerformanceHistory['range'],
  sort: PerformanceEndpointSort,
): Promise<ApiPerformanceMetric[]> {
  return apiFetch(`/api/admin/performance/endpoints?range=${range}&sort=${sort}`)
}

export function updatePerformanceThresholds(thresholds: PerformanceThresholds): Promise<PerformanceThresholds> {
  return apiFetch('/api/admin/performance/thresholds', {
    method: 'PUT',
    body: JSON.stringify(thresholds),
  })
}

export function getPerformanceAlertEvents(limit = 50): Promise<PerformanceAlertEvent[]> {
  return apiFetch(`/api/admin/performance/alerts?limit=${limit}`)
}
