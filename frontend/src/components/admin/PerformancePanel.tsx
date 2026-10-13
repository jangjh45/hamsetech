import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  getPerformanceAlertEvents,
  getPerformanceEndpoints,
  getPerformanceHistory,
  getPerformanceSnapshot,
  updatePerformanceThresholds,
  type ApiPerformanceMetric,
  type PerformanceAlertEvent,
  type PerformanceDashboardSnapshot,
  type PerformanceEndpointSort,
  type PerformanceHistory,
  type PerformanceHistoryPoint,
  type PerformanceThresholds,
} from '../../api/performance'

const REFRESH_MS = 5_000
const HISTORY_REFRESH_MS = 60_000
const RANGE_OPTIONS: { value: PerformanceHistory['range']; label: string }[] = [
  { value: '5m', label: '5분' },
  { value: '1h', label: '1시간' },
  { value: '24h', label: '24시간' },
]

function number(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('ko-KR', { maximumFractionDigits: digits })
}

function bytes(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let scaled = value
  let unit = 0
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024
    unit += 1
  }
  return `${number(scaled)} ${units[unit]}`
}

function ratioPercent(used: number | null | undefined, max: number | null | undefined): number | null {
  if (used == null || max == null || !Number.isFinite(used) || !Number.isFinite(max) || max <= 0) return null
  return Math.max(0, Math.min(100, used / max * 100))
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: 'warn' }) {
  return (
    <section className={`fl-card ad-perf-card${tone === 'warn' ? ' is-warn' : ''}`}>
      <div className="fl-card-body">
        <div className="ad-perf-label">{label}</div>
        <div className="ad-perf-value">{value}</div>
        {detail && <div className="ad-perf-detail">{detail}</div>}
      </div>
    </section>
  )
}

function TrendChart({
  points,
  value,
  format,
  label,
}: {
  points: PerformanceHistoryPoint[]
  value: (point: PerformanceHistoryPoint) => number | null
  format: (value: number) => string
  label: string
}) {
  const values = points.map((point) => value(point))
  const valid = values.filter((entry): entry is number => entry != null && Number.isFinite(entry))
  if (!valid.length) return <div className="ad-perf-chart-empty">기록 수집 중</div>

  const plot = { left: 14, right: 99, top: 4, bottom: 31 }
  const maxValue = Math.max(...valid)
  const rawStep = (maxValue > 0 ? maxValue : 1) / 3
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalizedStep = rawStep / magnitude
  const stepFactor = normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10
  const step = stepFactor * magnitude
  const chartMax = step * 3
  const axisDigits = step >= 1 ? 0 : Math.min(6, Math.ceil(-Math.log10(step)))
  const ticks = Array.from({ length: 4 }, (_, index) => ({
    value: step * index,
    y: plot.bottom - (plot.bottom - plot.top) * index / 3,
  }))
  const segments: { x: number; y: number; value: number; index: number }[][] = []
  let segment: { x: number; y: number; value: number; index: number }[] = []
  values.forEach((entry, index) => {
    if (entry == null || !Number.isFinite(entry)) {
      if (segment.length) segments.push(segment)
      segment = []
      return
    }
    const x = values.length < 2
      ? (plot.left + plot.right) / 2
      : plot.left + index / (values.length - 1) * (plot.right - plot.left)
    const y = plot.bottom - entry / chartMax * (plot.bottom - plot.top)
    segment.push({ x, y, value: entry, index })
  })
  if (segment.length) segments.push(segment)

  const latest = segments[segments.length - 1][segments[segments.length - 1].length - 1]
  const hasTrend = segments.some((pointsInSegment) => pointsInSegment.length > 1)
  const average = valid.reduce((sum, entry) => sum + entry, 0) / valid.length
  const formatPointTime = (index: number) => points[index]
    ? new Date(points[index].capturedAt).toLocaleString('ko-KR', { hour: '2-digit', minute: '2-digit' })
    : ''

  return (
    <>
      <div className="ad-perf-chart-value">
        <strong>{format(latest.value)}</strong>
        <span>최고 {format(maxValue)} · 평균 {format(average)}</span>
      </div>
      {hasTrend ? (
        <>
          <svg className="ad-perf-chart" viewBox="0 0 100 38" preserveAspectRatio="none" role="img" aria-label={label}>
            {ticks.map((tick) => (
              <g key={tick.value}>
                <line x1={plot.left} y1={tick.y} x2={plot.right} y2={tick.y} className="ad-perf-chart-gridline" />
                <text x={plot.left - 2} y={tick.y} className="ad-perf-chart-tick">{number(tick.value, axisDigits)}</text>
              </g>
            ))}
            {segments.map((pointsInSegment) => pointsInSegment.length > 1 && (
              <polygon key={`area-${pointsInSegment[0].index}`}
                points={`${pointsInSegment.map((point) => `${point.x},${point.y}`).join(' ')} ${pointsInSegment[pointsInSegment.length - 1].x},${plot.bottom} ${pointsInSegment[0].x},${plot.bottom}`}
                className="ad-perf-chart-area" />
            ))}
            {segments.map((pointsInSegment) => pointsInSegment.length > 1 && (
              <polyline key={`line-${pointsInSegment[0].index}`}
                points={pointsInSegment.map((point) => `${point.x},${point.y}`).join(' ')}
                className="ad-perf-chart-line" />
            ))}
          </svg>
          <div className="ad-perf-chart-labels">
            <span>{formatPointTime(0)}</span>
            <span>{points.length > 1 ? formatPointTime(points.length - 1) : ''}</span>
          </div>
        </>
      ) : (
        <div className="ad-perf-chart-empty">연속된 기록이 쌓이면 추이를 표시합니다</div>
      )}
    </>
  )
}

const TREND_METRICS = [
  { key: 'requests', label: '요청 처리량', unit: 'RPS', value: (point: PerformanceHistoryPoint) => point.requestsPerSecond,
    format: (value: number) => `${number(value, 2)} RPS` },
  { key: 'p95', label: 'p95 응답시간', unit: 'ms', value: (point: PerformanceHistoryPoint) => point.p95LatencyMs,
    format: (value: number) => `${number(value)} ms` },
  { key: 'systemMemory', label: 'NAS 메모리', unit: '%',
    value: (point: PerformanceHistoryPoint) => ratioPercent(point.systemMemoryUsedBytes, point.systemMemoryTotalBytes),
    format: (value: number) => `${number(value)}%` },
  { key: 'systemCpu', label: '시스템 CPU', unit: '%', value: (point: PerformanceHistoryPoint) => point.systemCpuPercent,
    format: (value: number) => `${number(value)}%` },
  { key: 'containerMemory', label: '컨테이너 메모리', unit: '%',
    value: (point: PerformanceHistoryPoint) => ratioPercent(point.containerMemoryUsedBytes, point.containerMemoryMaxBytes),
    format: (value: number) => `${number(value)}%` },
  { key: 'jvmHeap', label: 'JVM 힙', unit: '%',
    value: (point: PerformanceHistoryPoint) => ratioPercent(point.jvmHeapUsedBytes, point.jvmHeapMaxBytes),
    format: (value: number) => `${number(value)}%` },
  { key: 'dbPool', label: 'DB 연결 풀', unit: '%',
    value: (point: PerformanceHistoryPoint) => ratioPercent(point.dbConnectionsActive, point.dbConnectionsMax),
    format: (value: number) => `${number(value)}%` },
] as const

type TrendMetricKey = typeof TREND_METRICS[number]['key']
const DEFAULT_TREND_METRICS: TrendMetricKey[] = ['requests', 'p95', 'systemMemory']
const TREND_METRICS_STORAGE_KEY = 'hamsetech.admin.performance.trend-metrics.v1'

function readSavedTrendMetrics(): TrendMetricKey[] {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(TREND_METRICS_STORAGE_KEY) ?? 'null')
    if (!Array.isArray(saved)) return DEFAULT_TREND_METRICS
    const valid = saved.filter((key): key is TrendMetricKey =>
      TREND_METRICS.some((metric) => metric.key === key))
    return [...new Set(valid)].length ? [...new Set(valid)] : DEFAULT_TREND_METRICS
  } catch {
    return DEFAULT_TREND_METRICS
  }
}

const ENDPOINT_SORT_OPTIONS: { value: PerformanceEndpointSort; label: string }[] = [
  { value: 'p95', label: '최고 분 p95' },
  { value: 'errors', label: '오류율' },
  { value: 'requests', label: '요청 수' },
]

function ResourceItem({
  label,
  value,
  percent,
  detail,
}: {
  label: string
  value: string
  percent?: number | null
  detail?: string
}) {
  return (
    <div className="ad-perf-resource">
      <div><span>{label}</span><strong>{value}</strong></div>
      {percent != null && <div className="ad-perf-meter"><span style={{ width: `${percent}%` }} /></div>}
      {detail && <small>{detail}</small>}
    </div>
  )
}

const THRESHOLD_FIELDS: {
  key: keyof PerformanceThresholds
  label: string
  unit: string
  min: number
  max: number
  step: number
}[] = [
  { key: 'p95LatencyMs', label: 'API p95 응답시간', unit: 'ms', min: 1, max: 3_600_000, step: 10 },
  { key: 'errorRatePercent', label: '5xx 오류율', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'heapUsedPercent', label: 'JVM 힙 사용률', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'dbPoolUsedPercent', label: 'DB 연결 풀 사용률', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'containerMemoryUsedPercent', label: '컨테이너 메모리 사용률', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'systemCpuPercent', label: '시스템 CPU 사용률', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'systemMemoryUsedPercent', label: 'NAS 메모리 사용률', unit: '%', min: 0, max: 100, step: 0.1 },
  { key: 'uploadStorageFreePercent', label: '첨부 저장소 여유 공간 경고 (미만)', unit: '%', min: 0, max: 100, step: 0.1 },
]

function ThresholdSettings({
  thresholds,
  saving,
  message,
  onSave,
}: {
  thresholds: PerformanceThresholds
  saving: boolean
  message: string
  onSave: (thresholds: PerformanceThresholds) => void
}) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const next = {} as PerformanceThresholds
    THRESHOLD_FIELDS.forEach((field) => {
      next[field.key] = Number(formData.get(field.key))
    })
    onSave(next)
  }

  return (
    <details className="ad-perf-settings" key={JSON.stringify(thresholds)}>
      <summary>경고 기준 설정</summary>
      <form className="ad-perf-settings-form" onSubmit={submit}>
        <div className="ad-perf-threshold-grid">
          {THRESHOLD_FIELDS.map((field) => (
            <label className="ad-perf-threshold-field" key={field.key} htmlFor={`performance-threshold-${field.key}`}>
              <span>{field.label}</span>
              <span className="ad-perf-threshold-input">
                <input id={`performance-threshold-${field.key}`} className="fl-input" type="number" name={field.key}
                  min={field.min} max={field.max} step={field.step}
                  defaultValue={thresholds[field.key]} required />
                <small>{field.unit}</small>
              </span>
            </label>
          ))}
        </div>
        <div className="ad-perf-settings-actions">
          <span>{message || '변경한 기준은 서버에 저장되어 재시작 후에도 유지됩니다.'}</span>
          <button type="submit" className="fl-btn fl-btn-primary" disabled={saving}>
            {saving ? '저장 중…' : '기준 저장'}
          </button>
        </div>
      </form>
    </details>
  )
}

function AlertHistory({ events, error }: { events: PerformanceAlertEvent[]; error: string }) {
  return (
    <section className="fl-card ad-perf-alert-history-card">
      <details>
        <summary className="fl-card-head">
          <span className="fl-card-title">경고 이력</span>
          <span className="fl-card-count">최근 {events.length}건</span>
        </summary>
        {error && <div className="fl-error ad-perf-error">{error}</div>}
        <div className="ad-perf-alert-history-wrap" role="region" aria-label="성능 경고 이력" tabIndex={0}>
          <table className="ad-perf-table">
            <thead><tr><th>상태</th><th>경고 내용</th><th>발생 시 값 / 기준</th><th>시각</th></tr></thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>
                    <span className={`ad-perf-alert-state ${event.eventType === 'TRIGGERED' ? 'is-triggered' : 'is-resolved'}`}>
                      {event.eventType === 'TRIGGERED' ? '발생' : '해소'}
                    </span>
                  </td>
                  <td className="ad-perf-alert-message">{event.message}</td>
                  <td>{number(event.observedValue)} {event.unit}{event.thresholdValue == null
                    ? ''
                    : ` / ${number(event.thresholdValue)} ${event.unit}`}</td>
                  <td>{new Date(event.occurredAt).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
              {!events.length && <tr><td colSpan={4} className="ad-perf-empty-row">{error ? '경고 이력을 불러오지 못했습니다.' : '아직 기록된 경고가 없습니다.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  )
}

export default function PerformancePanel() {
  const [dashboard, setDashboard] = useState<PerformanceDashboardSnapshot | null>(null)
  const [history, setHistory] = useState<PerformanceHistory | null>(null)
  const [alertEvents, setAlertEvents] = useState<PerformanceAlertEvent[]>([])
  const [range, setRange] = useState<PerformanceHistory['range']>('1h')
  const [endpointRange, setEndpointRange] = useState<PerformanceHistory['range']>('5m')
  const [endpointSort, setEndpointSort] = useState<PerformanceEndpointSort>('p95')
  const [slowEndpoints, setSlowEndpoints] = useState<ApiPerformanceMetric[]>([])
  const [trendMetricKeys, setTrendMetricKeys] = useState<TrendMetricKey[]>(readSavedTrendMetrics)
  const [snapshotError, setSnapshotError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [endpointHistoryError, setEndpointHistoryError] = useState('')
  const [alertHistoryError, setAlertHistoryError] = useState('')
  const [thresholdSaving, setThresholdSaving] = useState(false)
  const [thresholdMessage, setThresholdMessage] = useState('')
  const [stale, setStale] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    try {
      window.localStorage.setItem(TREND_METRICS_STORAGE_KEY, JSON.stringify(trendMetricKeys))
    } catch {
      // Keep the current selection for this visit if browser storage is unavailable.
    }
  }, [trendMetricKeys])

  useEffect(() => {
    let stopped = false
    let inFlight = false
    let timeout: number | undefined

    const schedule = () => {
      if (!stopped && document.visibilityState === 'visible') {
        timeout = window.setTimeout(refresh, REFRESH_MS)
      }
    }

    const refresh = async () => {
      if (stopped || inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const next = await getPerformanceSnapshot()
        if (!stopped) {
          setDashboard(next)
          setStale(Date.now() - new Date(next.current.capturedAt).getTime() > 15_000)
          setSnapshotError('')
        }
      } catch {
        if (!stopped) {
          setSnapshotError('현재 성능 지표를 불러오지 못했습니다.')
          setStale(true)
        }
      } finally {
        inFlight = false
        schedule()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timeout != null) window.clearTimeout(timeout)
      } else {
        if (timeout != null) window.clearTimeout(timeout)
        void refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void refresh()
    return () => {
      stopped = true
      if (timeout != null) window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshToken])

  useEffect(() => {
    let stopped = false
    let inFlight = false
    let timeout: number | undefined

    const schedule = () => {
      if (!stopped && document.visibilityState === 'visible') {
        timeout = window.setTimeout(refresh, HISTORY_REFRESH_MS)
      }
    }

    const refresh = async () => {
      if (stopped || inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const next = await getPerformanceHistory(range)
        if (!stopped) {
          setHistory(next)
          setHistoryError('')
        }
      } catch {
        if (!stopped) setHistoryError('과거 추이를 불러오지 못했습니다.')
      } finally {
        inFlight = false
        schedule()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timeout != null) window.clearTimeout(timeout)
      } else {
        if (timeout != null) window.clearTimeout(timeout)
        void refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void refresh()
    return () => {
      stopped = true
      if (timeout != null) window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [range, refreshToken])

  useEffect(() => {
    let stopped = false
    let inFlight = false
    let timeout: number | undefined

    const schedule = () => {
      if (!stopped && document.visibilityState === 'visible') {
        timeout = window.setTimeout(refresh, HISTORY_REFRESH_MS)
      }
    }

    const refresh = async () => {
      if (stopped || inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const next = await getPerformanceEndpoints(endpointRange, endpointSort)
        if (!stopped) {
          setSlowEndpoints(next)
          setEndpointHistoryError('')
        }
      } catch {
        if (!stopped) setEndpointHistoryError('느린 API 이력을 불러오지 못했습니다.')
      } finally {
        inFlight = false
        schedule()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timeout != null) window.clearTimeout(timeout)
      } else {
        if (timeout != null) window.clearTimeout(timeout)
        void refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void refresh()
    return () => {
      stopped = true
      if (timeout != null) window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [endpointRange, endpointSort, refreshToken])

  useEffect(() => {
    let stopped = false
    let inFlight = false
    let timeout: number | undefined

    const schedule = () => {
      if (!stopped && document.visibilityState === 'visible') {
        timeout = window.setTimeout(refresh, HISTORY_REFRESH_MS)
      }
    }

    const refresh = async () => {
      if (stopped || inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        const next = await getPerformanceAlertEvents()
        if (!stopped) {
          setAlertEvents(next)
          setAlertHistoryError('')
        }
      } catch {
        if (!stopped) setAlertHistoryError('성능 경고 이력을 불러오지 못했습니다.')
      } finally {
        inFlight = false
        schedule()
      }
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (timeout != null) window.clearTimeout(timeout)
      } else {
        if (timeout != null) window.clearTimeout(timeout)
        void refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    void refresh()
    return () => {
      stopped = true
      if (timeout != null) window.clearTimeout(timeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [refreshToken])

  const snapshot = dashboard?.current
  const thresholds = dashboard?.thresholds
  const heapPercent = ratioPercent(snapshot?.jvmHeapUsedBytes, snapshot?.jvmHeapMaxBytes)
  const dbPercent = ratioPercent(snapshot?.dbConnectionsActive, snapshot?.dbConnectionsMax)
  const containerMemoryPercent = ratioPercent(snapshot?.containerMemoryUsedBytes, snapshot?.containerMemoryMaxBytes)
  const uploadFreePercent = snapshot?.uploadStorageUsableBytes != null && snapshot.uploadStorageTotalBytes != null && snapshot.uploadStorageTotalBytes > 0
    ? snapshot.uploadStorageUsableBytes / snapshot.uploadStorageTotalBytes * 100
    : null
  const alerts = useMemo(() => {
    if (!snapshot || !thresholds) return []
    const warnings: string[] = []
    if (snapshot.requestsLast60Seconds > 0 && snapshot.p95LatencyMs != null && snapshot.p95LatencyMs >= thresholds.p95LatencyMs) {
      warnings.push(`API p95 응답시간이 ${number(thresholds.p95LatencyMs)}ms 기준을 넘었습니다.`)
    }
    if (snapshot.requestsLast60Seconds > 0 && snapshot.errorRatePercent >= thresholds.errorRatePercent) {
      warnings.push(`5xx 오류율이 ${number(thresholds.errorRatePercent)}% 기준을 넘었습니다.`)
    }
    const heap = ratioPercent(snapshot.jvmHeapUsedBytes, snapshot.jvmHeapMaxBytes)
    if (heap != null && heap >= thresholds.heapUsedPercent) warnings.push(`JVM 힙 사용률이 ${number(thresholds.heapUsedPercent)}% 기준을 넘었습니다.`)
    const db = ratioPercent(snapshot.dbConnectionsActive, snapshot.dbConnectionsMax)
    if (snapshot.dbConnectionsPending != null && snapshot.dbConnectionsPending > 0) warnings.push('DB 연결을 기다리는 요청이 있습니다.')
    else if (db != null && db >= thresholds.dbPoolUsedPercent) warnings.push(`DB 연결 풀 사용률이 ${number(thresholds.dbPoolUsedPercent)}% 기준을 넘었습니다.`)
    const container = ratioPercent(snapshot.containerMemoryUsedBytes, snapshot.containerMemoryMaxBytes)
    if (container != null && container >= thresholds.containerMemoryUsedPercent) warnings.push(`컨테이너 메모리 사용률이 ${number(thresholds.containerMemoryUsedPercent)}% 기준을 넘었습니다.`)
    if (snapshot.systemCpuPercent != null && snapshot.systemCpuPercent >= thresholds.systemCpuPercent) warnings.push(`시스템 CPU 사용률이 ${number(thresholds.systemCpuPercent)}% 기준을 넘었습니다.`)
    const systemMemory = ratioPercent(snapshot.systemMemoryUsedBytes, snapshot.systemMemoryTotalBytes)
    if (systemMemory != null && systemMemory >= thresholds.systemMemoryUsedPercent) {
      warnings.push(`NAS 시스템 메모리 사용률이 ${number(thresholds.systemMemoryUsedPercent)}% 기준을 넘었습니다.`)
    }
    if (uploadFreePercent != null && uploadFreePercent < thresholds.uploadStorageFreePercent) {
      warnings.push(`첨부 저장소 여유 공간이 ${number(thresholds.uploadStorageFreePercent)}% 미만입니다.`)
    }
    return warnings
  }, [snapshot, thresholds, uploadFreePercent])

  const onRefresh = () => setRefreshToken((previous) => previous + 1)

  const toggleTrendMetric = (key: TrendMetricKey) => {
    setTrendMetricKeys((previous) => previous.includes(key)
      ? previous.length === 1 ? previous : previous.filter((entry) => entry !== key)
      : [...previous, key])
  }

  const selectedTrendMetrics = TREND_METRICS.filter((metric) => trendMetricKeys.includes(metric.key))

  const saveThresholds = async (next: PerformanceThresholds) => {
    setThresholdSaving(true)
    setThresholdMessage('')
    try {
      const saved = await updatePerformanceThresholds(next)
      setDashboard((previous) => previous ? { ...previous, thresholds: saved } : previous)
      setThresholdMessage('경고 기준을 저장했습니다.')
    } catch (error) {
      setThresholdMessage(error instanceof Error ? error.message : '경고 기준을 저장하지 못했습니다.')
    } finally {
      setThresholdSaving(false)
    }
  }

  return (
    <div className="ad-perf-panel">
      <section className="fl-card ad-perf-overview">
        <div className="fl-card-head">
          <div>
            <span className="fl-card-title">서비스 성능</span>
            <div className="ad-perf-subtitle">
              최근 API 요청 기준 · 현재 지표 5초마다 갱신
              {snapshot && <span> · 마지막 갱신 {new Date(snapshot.capturedAt).toLocaleTimeString('ko-KR')}</span>}
            </div>
          </div>
          <div className="ad-perf-head-actions">
            <span className={`fl-badge ${snapshotError || stale ? 'fl-tone-warn' : 'fl-tone-primary'}`}>
              {snapshotError ? '연결 확인 필요' : !snapshot ? '연결 중' : stale ? '갱신 지연' : '관측 중'}
            </span>
            <button type="button" className="fl-btn fl-btn-secondary ad-perf-refresh" onClick={onRefresh}>
              지금 갱신
            </button>
          </div>
        </div>

        {snapshotError && <div className="fl-error ad-perf-error">{snapshotError}</div>}
        {alerts.length > 0 && (
          <div className="ad-perf-alerts" role="status" aria-live="polite">
            <strong>확인이 필요한 지표 {alerts.length}개</strong>
            <ul>{alerts.map((alert) => <li key={alert}>{alert}</li>)}</ul>
          </div>
        )}
        {!snapshotError && !alerts.length && snapshot && <div className="ad-perf-ok">설정된 성능 기준을 넘은 지표가 없습니다.</div>}

        <div className="ad-perf-grid">
          <MetricCard
            label="요청 처리량"
            value={`${number(snapshot?.requestsPerSecond, 2)} RPS`}
            detail={`최근 5초 ${number(snapshot?.requestsLast5Seconds, 0)}건 · 최근 1분 ${number(snapshot?.requestsLast60Seconds, 0)}건`}
          />
          <MetricCard
            label="평균 응답시간"
            value={snapshot?.averageLatencyMs == null ? '—' : `${number(snapshot.averageLatencyMs)} ms`}
            detail={`p50 ${number(snapshot?.p50LatencyMs)} ms · p95 ${number(snapshot?.p95LatencyMs)} ms · p99 ${number(snapshot?.p99LatencyMs)} ms`}
            tone={snapshot?.p95LatencyMs != null && thresholds != null && snapshot.p95LatencyMs >= thresholds.p95LatencyMs ? 'warn' : undefined}
          />
          <MetricCard
            label="서버 오류율"
            value={`${number(snapshot?.errorRatePercent, 2)}%`}
            detail={`최근 1분 5xx ${number(snapshot?.serverErrorsLast60Seconds, 0)}건`}
            tone={snapshot != null && thresholds != null && snapshot.errorRatePercent >= thresholds.errorRatePercent && snapshot.requestsLast60Seconds > 0 ? 'warn' : undefined}
          />
        </div>
        {thresholds && <ThresholdSettings thresholds={thresholds} saving={thresholdSaving}
          message={thresholdMessage} onSave={(next) => void saveThresholds(next)} />}
      </section>

      <AlertHistory events={alertEvents} error={alertHistoryError} />

      <section className="fl-card ad-perf-history-card">
        <div className="fl-card-head ad-perf-history-head">
          <div>
            <span className="fl-card-title">성능 추이</span>
            <div className="ad-perf-subtitle">요청량은 직전 60초 평균 · 분 단위 저장 · 최대 {history?.retentionDays ?? 30}일 보관</div>
          </div>
          <div className="ad-perf-range" role="group" aria-label="성능 추이 조회 범위">
            {RANGE_OPTIONS.map((option) => (
              <button key={option.value} type="button" aria-pressed={range === option.value}
                className={range === option.value ? 'is-active' : ''} onClick={() => setRange(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="ad-perf-trend-options" role="group" aria-label="성능 추이 표시 지표">
          <span>표시 지표</span>
          {TREND_METRICS.map((metric) => (
            <button key={metric.key} type="button" aria-pressed={trendMetricKeys.includes(metric.key)}
              className={trendMetricKeys.includes(metric.key) ? 'is-selected' : ''}
              onClick={() => toggleTrendMetric(metric.key)}>
              {metric.label}
            </button>
          ))}
        </div>
        {historyError && <div className="fl-error ad-perf-error">{historyError}</div>}
        <div className="ad-perf-grid ad-perf-trends">
          {selectedTrendMetrics.map((metric) => (
            <div className="ad-perf-trend" key={metric.key}>
              <div className="fl-card-head"><span className="fl-card-title">{metric.label}</span><span className="fl-card-count">{metric.unit}</span></div>
              <div className="fl-card-body">
                <TrendChart points={history?.points ?? []} value={metric.value}
                  format={metric.format} label={`선택한 기간의 ${metric.label} 추이`} />
              </div>
            </div>
          ))}
        </div>
        {history?.oldestAvailable && <div className="ad-perf-history-note">표시 가능한 가장 오래된 기록: {new Date(history.oldestAvailable).toLocaleString('ko-KR')}</div>}
      </section>

      <div className="ad-perf-grid ad-perf-grid-secondary">
        <section className="fl-card ad-perf-resource-card">
          <div className="fl-card-head"><span className="fl-card-title">서버 및 컨테이너 자원</span></div>
          <div className="fl-card-body ad-perf-resource-list">
            <ResourceItem label="JVM 힙 메모리" value={`${bytes(snapshot?.jvmHeapUsedBytes)} / ${bytes(snapshot?.jvmHeapMaxBytes)}`}
              percent={heapPercent} detail={heapPercent == null ? 'JVM 메모리 지표를 사용할 수 없습니다.' : `${number(heapPercent)}% 사용`} />
            <ResourceItem label="JVM 논힙 메모리" value={`${bytes(snapshot?.jvmNonHeapUsedBytes)} / ${bytes(snapshot?.jvmNonHeapMaxBytes)}`} />
            <ResourceItem label="DB 연결 풀" value={`${number(snapshot?.dbConnectionsActive, 0)} 활성 / ${number(snapshot?.dbConnectionsIdle, 0)} 유휴 / ${number(snapshot?.dbConnectionsMax, 0)} 최대`}
              percent={dbPercent} detail={`대기 ${number(snapshot?.dbConnectionsPending, 0)}개${dbPercent == null ? ' · 풀 지표를 사용할 수 없습니다.' : ` · ${number(dbPercent)}% 사용`} `} />
            <ResourceItem label="컨테이너 메모리" value={`${bytes(snapshot?.containerMemoryUsedBytes)} / ${bytes(snapshot?.containerMemoryMaxBytes)}`}
              percent={containerMemoryPercent} detail={containerMemoryPercent == null ? 'cgroup 메모리 제한이 없거나 지표를 읽을 수 없습니다.' : `${number(containerMemoryPercent)}% 사용`} />
            <ResourceItem label="NAS 시스템 메모리" value={`${bytes(snapshot?.systemMemoryUsedBytes)} / ${bytes(snapshot?.systemMemoryTotalBytes)}`}
              percent={ratioPercent(snapshot?.systemMemoryUsedBytes, snapshot?.systemMemoryTotalBytes)} />
            <ResourceItem label="CPU 사용률" value={`프로세스 ${number(snapshot?.processCpuPercent)}% · 시스템 ${number(snapshot?.systemCpuPercent)}%`}
              percent={snapshot?.systemCpuPercent} />
            <ResourceItem label="첨부 저장소 여유 공간" value={`${bytes(snapshot?.uploadStorageUsableBytes)} / ${bytes(snapshot?.uploadStorageTotalBytes)}`}
              percent={uploadFreePercent == null ? null : 100 - uploadFreePercent}
              detail={uploadFreePercent == null ? '저장소 지표를 사용할 수 없습니다.' : `${number(uploadFreePercent)}% 여유`} />
          </div>
        </section>

        <section className="fl-card ad-perf-endpoints-card">
          <div className="fl-card-head ad-perf-endpoints-head">
            <div>
              <span className="fl-card-title">느린 API</span>
              <span className="fl-card-count">{RANGE_OPTIONS.find((option) => option.value === endpointRange)?.label} · {ENDPOINT_SORT_OPTIONS.find((option) => option.value === endpointSort)?.label} 정렬</span>
            </div>
            <div className="ad-perf-endpoint-controls">
              <label>
                <span>기간</span>
                <select className="fl-input" aria-label="느린 API 조회 기간" value={endpointRange}
                  onChange={(event) => setEndpointRange(event.target.value as PerformanceHistory['range'])}>
                  {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span>정렬</span>
                <select className="fl-input" aria-label="느린 API 정렬 기준" value={endpointSort}
                  onChange={(event) => setEndpointSort(event.target.value as PerformanceEndpointSort)}>
                  {ENDPOINT_SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </div>
          {endpointHistoryError && <div className="fl-error ad-perf-error">{endpointHistoryError}</div>}
          <div className="ad-perf-table-wrap" role="region" aria-label="느린 API 목록" tabIndex={0}>
            <table className="ad-perf-table">
              <thead><tr><th>API</th><th>요청</th><th>최고 분 p95</th><th>5xx</th></tr></thead>
              <tbody>
                {slowEndpoints.map((endpoint) => (
                  <tr key={`${endpoint.method}:${endpoint.path}`}>
                    <td><span className="ad-perf-method">{endpoint.method}</span><code>{endpoint.path}</code></td>
                    <td>{number(endpoint.requests, 0)}</td>
                    <td>{number(endpoint.p95LatencyMs)} ms</td>
                    <td className={endpoint.serverErrors > 0 ? 'is-warn' : ''}>{number(endpoint.serverErrors, 0)} ({number(endpoint.errorRatePercent)}%)</td>
                  </tr>
                ))}
                {!slowEndpoints.length && <tr><td colSpan={4} className="ad-perf-empty-row">
                  {endpointHistoryError ? '느린 API 이력을 불러오지 못했습니다.' : '선택한 기간에 저장된 API 집계가 없습니다.'}
                </td></tr>}
              </tbody>
            </table>
          </div>
          <div className="ad-perf-note">가변 경로는 숨겨 분 단위로 집계합니다. p95는 분별 근삿값 중 해당 기간의 최댓값입니다.</div>
        </section>
      </div>

      <p className="ad-perf-footnote">
        API 응답시간은 앱 서버 기준이며 Nginx·네트워크 시간은 포함하지 않습니다. 경고 기준은 서비스 SLO에 맞게 조정하세요. 부하 테스트는 별도 PC에서 실행하세요.
      </p>
    </div>
  )
}
