import { Link } from 'react-router-dom'
import type { OvertimeRecord } from '../api/overtimeRecords'

interface OvertimeSummaryProps {
  /** 이번 달 내 잔업/특근 기록 (Home의 useDashboardData에서 내려받는다) */
  records: OvertimeRecord[]
  authenticated: boolean
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export default function OvertimeSummary({ records, authenticated }: OvertimeSummaryProps) {
  if (!authenticated) {
    return (
      <>
        <div className="fl-card-head fl-plain">
          <span className="fl-card-title">이번 달 잔업/특근</span>
        </div>
        <div className="fl-card-body" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="fl-empty">로그인하면 이번 달 잔업/특근 현황을 확인할 수 있습니다.</div>
          <Link to="/login" className="fl-btn fl-btn-primary" style={{ textDecoration: 'none' }}>
            로그인하기
          </Link>
        </div>
      </>
    )
  }

  const overtimeMinutes = records
    .filter((r) => r.type === 'OVERTIME')
    .reduce((sum, r) => sum + r.totalMinutes, 0)
  const specialMinutes = records
    .filter((r) => r.type === 'SPECIAL')
    .reduce((sum, r) => sum + r.totalMinutes, 0)
  const pendingCount = records.filter((r) => r.status === 'PENDING').length

  return (
    <>
      <div className="fl-card-head fl-plain">
        <span className="fl-card-title">이번 달 잔업/특근</span>
        <span className={`fl-badge ${pendingCount > 0 ? 'fl-tone-danger' : ''}`}>
          승인 대기 {pendingCount}건
        </span>
      </div>

      <div className="fl-card-body" style={{ justifyContent: 'center' }}>
        <Row label="잔업" value={formatMinutes(overtimeMinutes)} />
        <Row label="특근" value={formatMinutes(specialMinutes)} />
      </div>

      <div className="fl-card-foot">
        <Link to="/overtime" className="fl-link">
          잔업/특근 관리 →
        </Link>
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 14, color: 'var(--fl-muted)' }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}
