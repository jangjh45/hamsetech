import { useEffect, useMemo, useState } from 'react'
import {
  getPerformanceHistory,
  getPerformanceSnapshot,
  type PerformanceDashboardSnapshot,
  type PerformanceHistory,
  type PerformanceHistoryPoint,
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

  const max = Math.max(1, ...valid)
  const coords = values.flatMap((entry, index) => entry == null || !Number.isFinite(entry)
    ? []
    : [`${values.length < 2 ? 50 : index / (values.length - 1) * 100},${29 - entry / max * 25}`])

  return (
    <>
      <div className="ad-perf-chart-value">{format(valid[valid.length - 1])}</div>
      <svg className="ad-perf-chart" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1="0" y1="30" x2="100" y2="30" className="ad-perf-chart-axis" />
        {coords.length > 1 && <polyline points={coords.join(' ')} className="ad-perf-chart-line" />}
        {coords.length === 1 && <circle cx="50" cy={coords[0].split(',')[1]} r="1.7" className="ad-perf-chart-dot" />}
      </svg>
      <div className="ad-perf-chart-labels">
        <span>{points[0] ? new Date(points[0].capturedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
        <span>{points.length > 1 ? new Date(points[points.length - 1].capturedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      </div>
    </>
  )
}

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

export default function PerformancePanel() {
  const [dashboard, setDashboard] = useState<PerformanceDashboardSnapshot | null>(null)
  const [history, setHistory] = useState<PerformanceHistory | null>(null)
  const [range, setRange] = useState<PerformanceHistory['range']>('1h')
  const [snapshotError, setSnapshotError] = useState('')
  const [historyError, setHistoryError] = useState('')
  const [stale, setStale] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

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
      warnings.push(`API p95 응답시간이 ${number(thresholds.p95LatencyMs, 0)}ms 기준을 넘었습니다.`)
    }
    if (snapshot.requestsLast60Seconds > 0 && snapshot.errorRatePercent >= thresholds.errorRatePercent) {
      warnings.push(`5xx 오류율이 ${number(thresholds.errorRatePercent)}% 기준을 넘었습니다.`)
    }
    const heap = ratioPercent(snapshot.jvmHeapUsedBytes, snapshot.jvmHeapMaxBytes)
    if (heap != null && heap >= thresholds.heapUsedPercent) warnings.push(`JVM 힙 사용률이 ${number(thresholds.heapUsedPercent, 0)}% 기준을 넘었습니다.`)
    const db = ratioPercent(snapshot.dbConnectionsActive, snapshot.dbConnectionsMax)
    if (snapshot.dbConnectionsPending != null && snapshot.dbConnectionsPending > 0) warnings.push('DB 연결을 기다리는 요청이 있습니다.')
    else if (db != null && db >= thresholds.dbPoolUsedPercent) warnings.push(`DB 연결 풀 사용률이 ${number(thresholds.dbPoolUsedPercent, 0)}% 기준을 넘었습니다.`)
    const container = ratioPercent(snapshot.containerMemoryUsedBytes, snapshot.containerMemoryMaxBytes)
    if (container != null && container >= thresholds.containerMemoryUsedPercent) warnings.push(`컨테이너 메모리 사용률이 ${number(thresholds.containerMemoryUsedPercent, 0)}% 기준을 넘었습니다.`)
    if (snapshot.systemCpuPercent != null && snapshot.systemCpuPercent >= thresholds.systemCpuPercent) warnings.push(`시스템 CPU 사용률이 ${number(thresholds.systemCpuPercent, 0)}% 기준을 넘었습니다.`)
    const systemMemory = ratioPercent(snapshot.systemMemoryUsedBytes, snapshot.systemMemoryTotalBytes)
    if (systemMemory != null && systemMemory >= thresholds.systemMemoryUsedPercent) {
      warnings.push(`NAS 시스템 메모리 사용률이 ${number(thresholds.systemMemoryUsedPercent, 0)}% 기준을 넘었습니다.`)
    }
    if (uploadFreePercent != null && uploadFreePercent < thresholds.uploadStorageFreePercent) {
      warnings.push(`첨부 저장소 여유 공간이 ${number(thresholds.uploadStorageFreePercent, 0)}% 미만입니다.`)
    }
    return warnings
  }, [snapshot, thresholds, uploadFreePercent])

  const onRefresh = () => setRefreshToken((previous) => previous + 1)

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
      </section>

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
        {historyError && <div className="fl-error ad-perf-error">{historyError}</div>}
        <div className="ad-perf-grid ad-perf-trends">
          <div className="ad-perf-trend">
            <div className="fl-card-head"><span className="fl-card-title">요청 처리량</span><span className="fl-card-count">RPS</span></div>
            <div className="fl-card-body">
              <TrendChart points={history?.points ?? []} value={(point) => point.requestsPerSecond}
                format={(value) => `${number(value, 2)} RPS`} label="선택한 기간의 분당 요청 처리량 추이" />
            </div>
          </div>
          <div className="ad-perf-trend">
            <div className="fl-card-head"><span className="fl-card-title">p95 응답시간</span><span className="fl-card-count">ms</span></div>
            <div className="fl-card-body">
              <TrendChart points={history?.points ?? []} value={(point) => point.p95LatencyMs}
                format={(value) => `${number(value)} ms`} label="선택한 기간의 분당 p95 응답시간 추이" />
            </div>
          </div>
          <div className="ad-perf-trend">
            <div className="fl-card-head"><span className="fl-card-title">NAS 메모리 사용률</span><span className="fl-card-count">%</span></div>
            <div className="fl-card-body">
              <TrendChart points={history?.points ?? []}
                value={(point) => ratioPercent(point.systemMemoryUsedBytes, point.systemMemoryTotalBytes)}
                format={(value) => `${number(value)}%`} label="선택한 기간의 NAS 시스템 메모리 사용률 추이" />
            </div>
          </div>
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
          <div className="fl-card-head">
            <span className="fl-card-title">느린 API</span>
            <span className="fl-card-count">최근 1분 · p95 기준</span>
          </div>
          <div className="ad-perf-table-wrap">
            <table className="ad-perf-table">
              <thead><tr><th>API</th><th>요청</th><th>p95</th><th>5xx</th></tr></thead>
              <tbody>
                {(dashboard?.endpoints ?? []).map((endpoint) => (
                  <tr key={`${endpoint.method}:${endpoint.path}`}>
                    <td><span className="ad-perf-method">{endpoint.method}</span><code>{endpoint.path}</code></td>
                    <td>{number(endpoint.requests, 0)}</td>
                    <td>{number(endpoint.p95LatencyMs)} ms</td>
                    <td className={endpoint.serverErrors > 0 ? 'is-warn' : ''}>{number(endpoint.serverErrors, 0)} ({number(endpoint.errorRatePercent)}%)</td>
                  </tr>
                ))}
                {!dashboard?.endpoints.length && <tr><td colSpan={4} className="ad-perf-empty-row">최근 1분 동안 집계된 API가 없습니다.</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="ad-perf-note">경로의 ID·날짜 등 가변 값은 숨겨 집계합니다. p95는 메모리 절약형 히스토그램의 근사치입니다.</div>
        </section>
      </div>

      <p className="ad-perf-footnote">
        API 응답시간은 앱 서버 기준이며 Nginx·네트워크 시간은 포함하지 않습니다. 경고 기준은 초기 기본값으로 서비스 SLO와 다를 수 있으며, 서버 설정으로 조정할 수 있습니다. 부하 테스트는 별도 PC에서 실행하세요.
      </p>
    </div>
  )
}
