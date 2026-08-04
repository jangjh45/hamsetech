import { Link } from 'react-router-dom'
import type { OvertimeRecord } from '../api/overtimeRecords'
import { formatMinutes } from '../utils/formatDate'

interface OvertimeSummaryProps {
  /** 이번 달 내 잔업/특근 기록 (Home의 useDashboardData에서 내려받는다) */
  records: OvertimeRecord[]
}

export default function OvertimeSummary({ records }: OvertimeSummaryProps) {
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
        <span className={`fl-badge ${pendingCount > 0 ? 'fl-tone-warn' : ''}`}>
          승인 대기 {pendingCount}건
        </span>
      </div>

      <div className="fl-card-body" style={{ justifyContent: 'center' }}>
        <Row label="잔업" value={formatMinutes(overtimeMinutes)} />
        <Row label="특근" value={formatMinutes(specialMinutes)} />
        <div style={{ height: 1, background: 'var(--fl-divider)' }} />
        <Row label="합계" value={formatMinutes(overtimeMinutes + specialMinutes)} strong />
      </div>

      <div className="fl-card-foot">
        <Link to="/overtime" className="fl-link">
          잔업/특근 관리 →
        </Link>
      </div>
    </>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ fontSize: 14, fontWeight: strong ? 600 : 400, color: strong ? 'var(--fl-text)' : 'var(--fl-muted)' }}>
        {label}
      </span>
      <span style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}
