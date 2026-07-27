import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listNotices, type Notice } from '../api/notices'

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}.${m}.${day}`
}

export default function RecentNotices() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    listNotices(0, 5)
      .then((page) => setNotices(page.content))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div
        style={{
          fontWeight: 700,
          fontSize: isMobile ? 14 : 16,
          marginBottom: isMobile ? 8 : 12,
          textAlign: isMobile ? 'center' : 'left',
        }}
      >
        최근 공지사항
      </div>

      <div
        className="card"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 8 : 10,
        }}
      >
        {loading && (
          <div style={{ opacity: 0.6, textAlign: 'center', fontSize: isMobile ? 12 : 14, padding: isMobile ? '20px 0' : '24px 0' }}>
            불러오는 중...
          </div>
        )}

        {!loading && notices.length === 0 && (
          <div style={{ opacity: 0.6, textAlign: 'center', fontSize: isMobile ? 12 : 14, padding: isMobile ? '20px 0' : '24px 0' }}>
            공지사항이 없습니다.
          </div>
        )}

        {!loading &&
          notices.map((notice) => (
            <Link
              key={notice.id}
              to={`/notice/${notice.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 10 : 12,
                background: 'rgba(109, 139, 255, 0.05)',
                border: '1px solid rgba(109, 139, 255, 0.15)',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '14px',
                width: '100%',
                minWidth: 0,
                boxSizing: 'border-box',
                textDecoration: 'none',
                color: 'var(--text)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(109, 139, 255, 0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(109, 139, 255, 0.05)')}
            >
              <span
                style={{
                  flex: 1,
                  fontSize: isMobile ? 14 : 16,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  minWidth: 0,
                }}
              >
                {notice.title}
              </span>
              <span style={{ fontSize: isMobile ? 11 : 12, opacity: 0.6, flexShrink: 0, whiteSpace: 'nowrap' }}>
                {notice.authorDisplayName || notice.authorUsername} · {formatDate(notice.createdAt)}
              </span>
            </Link>
          ))}

        <Link
          to="/notices"
          style={{
            textAlign: 'center',
            fontSize: isMobile ? 13 : 14,
            fontWeight: 600,
            color: 'var(--primary)',
            textDecoration: 'none',
            padding: isMobile ? '8px 0 4px' : '10px 0 4px',
          }}
        >
          공지사항 전체보기 →
        </Link>
      </div>
    </div>
  )
}
