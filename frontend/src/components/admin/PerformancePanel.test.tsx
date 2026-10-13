import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PerformancePanel from './PerformancePanel'
import type { PerformanceDashboardSnapshot, PerformanceHistory } from '../../api/performance'

vi.mock('../../api/performance', () => ({
  getPerformanceSnapshot: vi.fn(),
  getPerformanceHistory: vi.fn(),
  getPerformanceAlertEvents: vi.fn(),
  getPerformanceEndpoints: vi.fn(),
  updatePerformanceThresholds: vi.fn(),
}))

import {
  getPerformanceAlertEvents,
  getPerformanceEndpoints,
  getPerformanceHistory,
  getPerformanceSnapshot,
  updatePerformanceThresholds,
} from '../../api/performance'

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
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.removeItem('hamsetech.admin.performance.trend-metrics.v1')
    vi.mocked(getPerformanceSnapshot).mockResolvedValue(dashboard)
    vi.mocked(getPerformanceHistory).mockImplementation(async (range) => ({ ...history, range }))
    vi.mocked(getPerformanceAlertEvents).mockResolvedValue([])
    vi.mocked(getPerformanceEndpoints).mockResolvedValue(dashboard.endpoints)
    vi.mocked(updatePerformanceThresholds).mockImplementation(async (thresholds) => thresholds)
  })

  it('shows threshold warnings, masked endpoint stats, and requests a selected history range', async () => {
    render(<PerformancePanel />)

    expect(await screen.findByText('확인이 필요한 지표 8개')).toBeTruthy()
    expect(await screen.findByText('/api/notices/{id}')).toBeTruthy()
    expect(screen.getByText(/대기 1개/)).toBeTruthy()
    expect(screen.getByRole('region', { name: '느린 API 목록' }).getAttribute('tabindex')).toBe('0')
    expect(screen.getByText('최고 2.4 RPS · 평균 2.4 RPS')).toBeTruthy()
    expect(screen.queryByRole('img', { name: '선택한 기간의 분당 요청 처리량 추이' })).toBeNull()
    expect(screen.getAllByText('연속된 기록이 쌓이면 추이를 표시합니다')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: '24시간' }))
    await waitFor(() => expect(getPerformanceHistory).toHaveBeenCalledWith('24h'))
  })

  it('draws a line without point markers when multiple history samples are available', async () => {
    const points = [1, 2, 3].map((sample, index) => ({
      ...history.points[0],
      capturedAt: `2026-10-13T08:0${index}:00Z`,
      requestsPerSecond: sample,
      p95LatencyMs: sample * 10,
    }))
    vi.mocked(getPerformanceHistory).mockResolvedValue({ ...history, points })

    render(<PerformancePanel />)

    const chart = await screen.findByRole('img', { name: '선택한 기간의 요청 처리량 추이' })
    expect(chart.querySelectorAll('polyline')).toHaveLength(1)
    expect(chart.querySelectorAll('circle')).toHaveLength(0)
  })

  it('saves administrator-edited thresholds', async () => {
    render(<PerformancePanel />)

    fireEvent.click(await screen.findByText('경고 기준 설정'))
    fireEvent.change(screen.getByLabelText(/API p95 응답시간/), { target: { value: '1500' } })
    fireEvent.submit(screen.getByRole('button', { name: '기준 저장' }).closest('form')!)

    await waitFor(() => expect(updatePerformanceThresholds).toHaveBeenCalledWith({
      ...dashboard.thresholds,
      p95LatencyMs: 1500,
    }))
    expect(await screen.findByText('경고 기준을 저장했습니다.')).toBeTruthy()
  })

  it('shows persisted performance alert events', async () => {
    vi.mocked(getPerformanceAlertEvents).mockResolvedValue([{
      id: 1,
      alertKey: 'p95_latency',
      eventType: 'TRIGGERED',
      message: 'API p95 응답시간이 2000ms 기준을 넘었습니다.',
      observedValue: 2400,
      thresholdValue: 2000,
      unit: 'ms',
      occurredAt: '2026-10-13T08:00:00Z',
    }])

    render(<PerformancePanel />)

    fireEvent.click(screen.getByText('경고 이력'))
    expect(await screen.findByText('API p95 응답시간이 2000ms 기준을 넘었습니다.')).toBeTruthy()
    expect(screen.getByText('발생')).toBeTruthy()
    expect(screen.getByText('2,400 ms / 2,000 ms')).toBeTruthy()
  })

  it('shows current container memory usage when Docker has no memory limit', async () => {
    vi.mocked(getPerformanceSnapshot).mockResolvedValue({
      ...dashboard,
      current: { ...dashboard.current, containerMemoryMaxBytes: null },
    })

    render(<PerformancePanel />)

    expect(await screen.findByText('1.8 KB 사용 · 제한 없음')).toBeTruthy()
    expect(screen.getByText('메모리 상한이 없어 사용률은 계산하지 않습니다.')).toBeTruthy()
    const resource = screen.getByText('컨테이너 메모리', {
      selector: '.ad-perf-resource > div:first-child > span',
    }).closest('.ad-perf-resource')
    expect(resource?.querySelector('.ad-perf-meter')).toBeNull()
  })

  it('requests slow API history using the selected period and sort order', async () => {
    render(<PerformancePanel />)

    fireEvent.change(screen.getByLabelText('느린 API 조회 기간'), { target: { value: '24h' } })
    await waitFor(() => expect(getPerformanceEndpoints).toHaveBeenCalledWith('24h', 'p95'))

    fireEvent.change(screen.getByLabelText('느린 API 정렬 기준'), { target: { value: 'errors' } })
    await waitFor(() => expect(getPerformanceEndpoints).toHaveBeenCalledWith('24h', 'errors'))
  })

  it('lets administrators select resource trend charts', async () => {
    render(<PerformancePanel />)

    const cpuToggle = await screen.findByRole('button', { name: '시스템 CPU' })
    expect(cpuToggle.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(cpuToggle)
    expect(cpuToggle.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('시스템 CPU', { selector: '.fl-card-title' })).toBeTruthy()

    cleanup()
    render(<PerformancePanel />)
    expect((await screen.findByRole('button', { name: '시스템 CPU' })).getAttribute('aria-pressed')).toBe('true')
  })

  it('draws container memory usage history even when cgroup has no memory limit', async () => {
    const points = [1, 2, 3].map((usedGiB, index) => ({
      ...history.points[0],
      capturedAt: `2026-10-13T08:0${index}:00Z`,
      containerMemoryUsedBytes: usedGiB * 1024 ** 3,
      containerMemoryMaxBytes: null,
    }))
    vi.mocked(getPerformanceHistory).mockResolvedValue({ ...history, points })

    render(<PerformancePanel />)
    fireEvent.click(await screen.findByRole('button', { name: '컨테이너 메모리 사용량' }))

    const chart = await screen.findByRole('img', { name: '선택한 기간의 컨테이너 메모리 사용량 추이' })
    expect(chart.querySelectorAll('polyline')).toHaveLength(1)
    expect(screen.getByText('3 GiB')).toBeTruthy()
  })
})
