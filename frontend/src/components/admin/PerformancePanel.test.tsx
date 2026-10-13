import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PerformancePanel from './PerformancePanel'
import type { PerformanceDashboardSnapshot, PerformanceHistory } from '../../api/performance'

vi.mock('../../api/performance', () => ({
  getPerformanceSnapshot: vi.fn(),
  getPerformanceHistory: vi.fn(),
}))

import { getPerformanceHistory, getPerformanceSnapshot } from '../../api/performance'

const dashboard: PerformanceDashboardSnapshot = {
  current: {
    capturedAt: '2026-10-13T08:00:00Z',
    requestsLast5Seconds: 12,
    requestsLast60Seconds: 120,
    serverErrorsLast60Seconds: 4,
    requestsPerSecond: 2.4,
    errorRatePercent: 3.3,
    averageLatencyMs: 450,
    p50LatencyMs: 180,
    p95LatencyMs: 2400,
    p99LatencyMs: 3200,
    jvmHeapUsedBytes: 900,
    jvmHeapMaxBytes: 1000,
    dbConnectionsActive: 5,
    dbConnectionsIdle: 0,
    dbConnectionsPending: 1,
    dbConnectionsMax: 5,
    jvmNonHeapUsedBytes: 200,
    jvmNonHeapMaxBytes: 500,
    processCpuPercent: 45,
    systemCpuPercent: 95,
    containerMemoryUsedBytes: 1800,
    containerMemoryMaxBytes: 2000,
    systemMemoryUsedBytes: 9000,
    systemMemoryTotalBytes: 10000,
    uploadStorageUsableBytes: 500,
    uploadStorageTotalBytes: 10000,
  },
  endpoints: [{
    method: 'GET',
    path: '/api/notices/{id}',
    requests: 10,
    serverErrors: 1,
    errorRatePercent: 10,
    averageLatencyMs: 400,
    p95LatencyMs: 2400,
    p99LatencyMs: 3200,
  }],
  thresholds: {
    p95LatencyMs: 2000,
    errorRatePercent: 1,
    heapUsedPercent: 85,
    dbPoolUsedPercent: 80,
    containerMemoryUsedPercent: 85,
    systemCpuPercent: 90,
    systemMemoryUsedPercent: 90,
    uploadStorageFreePercent: 10,
  },
}

const history: PerformanceHistory = {
  range: '1h',
  capturedAt: '2026-10-13T08:00:00Z',
  oldestAvailable: '2026-10-13T07:00:00Z',
  retentionDays: 30,
  points: [{
    capturedAt: '2026-10-13T08:00:00Z',
    requestsPerSecond: 2.4,
    errorRatePercent: 3.3,
    p95LatencyMs: 2400,
    jvmHeapUsedBytes: 900,
    jvmHeapMaxBytes: 1000,
    dbConnectionsActive: 5,
    dbConnectionsMax: 5,
    systemCpuPercent: 95,
    containerMemoryUsedBytes: 1800,
    containerMemoryMaxBytes: 2000,
    systemMemoryUsedBytes: 9000,
    systemMemoryTotalBytes: 10000,
  }],
}

describe('PerformancePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getPerformanceSnapshot).mockResolvedValue(dashboard)
    vi.mocked(getPerformanceHistory).mockImplementation(async (range) => ({ ...history, range }))
  })

  it('shows threshold warnings, masked endpoint stats, and requests a selected history range', async () => {
    render(<PerformancePanel />)

    expect(await screen.findByText('확인이 필요한 지표 8개')).toBeTruthy()
    expect(screen.getByText('/api/notices/{id}')).toBeTruthy()
    expect(screen.getByText(/대기 1개/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '24시간' }))
    await waitFor(() => expect(getPerformanceHistory).toHaveBeenCalledWith('24h'))
  })
})
