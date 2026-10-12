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
  dbConnectionsMax: number | null
}

export function getPerformanceSnapshot(): Promise<PerformanceSnapshot> {
  return apiFetch('/api/admin/performance')
}
