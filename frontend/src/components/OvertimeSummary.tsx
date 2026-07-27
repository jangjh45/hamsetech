import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listMyOvertimeRecords, type OvertimeRecord } from '../api/overtimeRecords'
import { isAuthenticated } from '../auth/token'

function toYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  if (m === 0) return `${h}시간`
  return `${h}시간 ${m}분`
}

export default function OvertimeSummary() {
  const [records, setRecords] = useState<OvertimeRecord[]>([])
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [authenticated, setAuthenticated] = useState<boolean>(isAuthenticated())

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const handleAuthChange = () => setAuthenticated(isAuthenticated())
    window.addEventListener('auth-changed', handleAuthChange)
    return () => window.removeEventListener('auth-changed', handleAuthChange)
  }, [])

  useEffect(() => {
    if (!authenticated) {
      setRecords([])
      return
    }
    const now = new Date()
    const from = toYmd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    listMyOvertimeRecords(from, to)
      .then((data) => setRecords(data))
      .catch(() => {})
  }, [authenticated])

  const title = (
    <div
      style={{
        fontWeight: 700,
        fontSize: isMobile ? 14 : 16,
        marginBottom: isMobile ? 8 : 12,
        textAlign: isMobile ? 'center' : 'left',
      }}
    >
      이번 달 잔업/특근
    </div>
  )

  if (!authenticated) {
    return (
      <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
        {title}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '32px 16px' : '48px 32px',
            textAlign: 'center',
            gap: isMobile ? 12 : 16,
          }}
        >
          <div style={{ fontSize: isMobile ? 14 : 16, opacity: 0.7, lineHeight: 1.5 }}>
            로그인하면 이번 달 잔업/특근 현황을 확인할 수 있습니다.
          </div>
          <Link
            to="/login"
            style={{
              display: 'inline-block',
              padding: isMobile ? '8px 20px' : '10px 24px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 6,
              fontWeight: 600,
              fontSize: isMobile ? 14 : 16,
            }}
          >
            로그인하기
          </Link>
        </div>
      </div>
    )
  }

  const overtimeMinutes = records.filter((r) => r.type === 'OVERTIME').reduce((sum, r) => sum + r.totalMinutes, 0)
  const specialMinutes = records.filter((r) => r.type === 'SPECIAL').reduce((sum, r) => sum + r.totalMinutes, 0)
  const pendingCount = records.filter((r) => r.status === 'PENDING').length

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      {title}
      <Link
        to="/overtime"
        style={{
          display: 'block',
          textDecoration: 'none',
          color: 'var(--text)',
        }}
      >
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 12 : 14,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', gap: isMobile ? 10 : 12 }}>
            {/* 잔업 */}
            <div
              style={{
                flex: 1,
                background: 'rgba(109, 139, 255, 0.08)',
                border: '1px solid rgba(109, 139, 255, 0.15)',
                borderRadius: 10,
                padding: isMobile ? '12px' : '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7, marginBottom: 6 }}>잔업</div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'var(--primary)' }}>
                {formatMinutes(overtimeMinutes)}
              </div>
            </div>
            {/* 특근 */}
            <div
              style={{
                flex: 1,
                background: 'rgba(255, 152, 0, 0.08)',
                border: '1px solid rgba(255, 152, 0, 0.2)',
                borderRadius: 10,
                padding: isMobile ? '12px' : '16px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7, marginBottom: 6 }}>특근</div>
              <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'rgb(255, 152, 0)' }}>
                {formatMinutes(specialMinutes)}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: isMobile ? 13 : 14, opacity: 0.8 }}>승인 대기</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: isMobile ? 24 : 28,
                height: isMobile ? 24 : 28,
                padding: '0 8px',
                borderRadius: 999,
                fontSize: isMobile ? 12 : 13,
                fontWeight: 700,
                backgroundColor: pendingCount > 0 ? 'rgba(244, 67, 54, 0.15)' : 'rgba(136, 136, 136, 0.15)',
                color: pendingCount > 0 ? 'rgb(244, 67, 54)' : 'rgb(136, 136, 136)',
              }}
            >
              {pendingCount}건
            </span>
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: isMobile ? 13 : 14,
              fontWeight: 600,
              color: 'var(--primary)',
              paddingTop: 2,
            }}
          >
            잔업/특근 관리 바로가기 →
          </div>
        </div>
      </Link>
    </div>
  )
}
