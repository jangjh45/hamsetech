import { useEffect, useState } from 'react'
import { getPerformanceSnapshot, type PerformanceSnapshot } from '../../api/performance'

const REFRESH_MS = 5_000
const CHART_POINTS = 12

function number(value: number | null | undefined, digits = 1): string {
  return value == null || !Number.isFinite(value) ? '—' : value.toLocaleString('ko-KR', { maximumFractionDigits: digits })
}

function bytes(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return `${number(value / 1024 / 1024)} MB`
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <section className="fl-card ad-perf-card">
      <div className="fl-card-body">
        <div className="ad-perf-label">{label}</div>
        <div className="ad-perf-value">{value}</div>
        {detail && <div className="ad-perf-detail">{detail}</div>}
      </div>
    </section>
  )
}

function ThroughputChart({ values }: { values: number[] }) {
  const max = Math.max(1, ...values)
  const points = values
    .map((value, index) => `${values.length < 2 ? 50 : (index / (values.length - 1)) * 100},${29 - (value / max) * 25}`)
    .join(' ')

  return (
    <svg className="ad-perf-chart" viewBox="0 0 100 32" preserveAspectRatio="none" role="img" aria-label="최근 1분 요청 처리량 추이">
      <line x1="0" y1="30" x2="100" y2="30" className="ad-perf-chart-axis" />
      {values.length > 1 && <polyline points={points} className="ad-perf-chart-line" />}
      {values.length === 1 && <circle cx="50" cy={29 - (values[0] / max) * 25} r="1.7" className="ad-perf-chart-dot" />}
    </svg>
  )
}

export default function PerformancePanel() {
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null)
  const [samples, setSamples] = useState<number[]>([])
  const [error, setError] = useState('')

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
          setSnapshot(next)
          setSamples((previous) => [...previous, next.requestsPerSecond].slice(-CHART_POINTS))
          setError('')
        }
      } catch {
        if (!stopped) setError('성능 지표를 불러오지 못했습니다. 잠시 후 다시 시도합니다.')
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
  }, [])

  const heapPercent = snapshot?.jvmHeapUsedBytes != null && snapshot.jvmHeapMaxBytes != null && snapshot.jvmHeapMaxBytes > 0
    ? Math.min(100, (snapshot.jvmHeapUsedBytes / snapshot.jvmHeapMaxBytes) * 100)
    : null
  const dbActive = snapshot?.dbConnectionsActive
  const dbMax = snapshot?.dbConnectionsMax

  return (
    <div className="ad-perf-panel">
      <section className="fl-card ad-perf-overview">
        <div className="fl-card-head">
          <div>
            <span className="fl-card-title">서비스 성능</span>
            <div className="ad-perf-subtitle">
              최근 API 요청 기준 · 5초마다 갱신
              {snapshot && <span> · 마지막 갱신 {new Date(snapshot.capturedAt).toLocaleTimeString('ko-KR')}</span>}
            </div>
          </div>
          <span className={`fl-badge ${error ? 'fl-tone-warn' : 'fl-tone-primary'}`}>
            {error ? '연결 확인 필요' : '관측 중'}
          </span>
        </div>

        {error && <div className="fl-error ad-perf-error">{error}</div>}

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
          />
          <MetricCard
            label="서버 오류율"
            value={`${number(snapshot?.errorRatePercent, 2)}%`}
            detail={`최근 1분 5xx ${number(snapshot?.serverErrorsLast60Seconds, 0)}건`}
          />
        </div>
      </section>

      <div className="ad-perf-grid ad-perf-grid-secondary">
        <section className="fl-card">
          <div className="fl-card-head"><span className="fl-card-title">요청 처리량 추이</span><span className="fl-card-count">최근 1분</span></div>
          <div className="fl-card-body">
            <div className="ad-perf-chart-value">{samples.length ? `${number(samples[samples.length - 1], 2)} RPS` : '측정 대기 중'}</div>
            <ThroughputChart values={samples} />
            <div className="ad-perf-note">그래프는 관리자 화면을 연 이후의 5초 단위 관측값입니다.</div>
          </div>
        </section>

        <section className="fl-card">
          <div className="fl-card-head"><span className="fl-card-title">서버 자원</span></div>
          <div className="fl-card-body ad-perf-resource-list">
            <div className="ad-perf-resource">
              <div><span>JVM 힙 메모리</span><strong>{bytes(snapshot?.jvmHeapUsedBytes ?? null)} / {bytes(snapshot?.jvmHeapMaxBytes ?? null)}</strong></div>
              <div className="ad-perf-meter"><span style={{ width: `${heapPercent ?? 0}%` }} /></div>
              {heapPercent == null && <small>메모리 지표를 사용할 수 없습니다.</small>}
            </div>
            <div className="ad-perf-resource">
              <div><span>DB 연결 풀</span><strong>{number(dbActive, 0)} / {number(dbMax, 0)} 연결</strong></div>
              <div className="ad-perf-meter"><span style={{ width: `${dbActive != null && dbMax != null && dbMax > 0 ? Math.min(100, dbActive / dbMax * 100) : 0}%` }} /></div>
              {(dbActive == null || dbMax == null) && <small>DB 연결 풀 지표를 사용할 수 없습니다.</small>}
            </div>
          </div>
        </section>
      </div>

      <p className="ad-perf-footnote">
        지표는 현재 실행 중인 서버의 최근 60초 API 요청을 기준으로 계산하며, p50/p95/p99는 메모리 절약형 히스토그램의 근사치입니다. 재시작하면 초기화됩니다. 부하 테스트는 별도 PC의 k6에서 실행하세요.
      </p>
    </div>
  )
}
