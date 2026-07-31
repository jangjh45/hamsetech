import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { listNotices, type Notice } from '../api/notices'

// 목록에는 MM.DD만 노출한다 (연도와 작성자는 공지사항 페이지에서 확인)
function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}`
}

export default function RecentNotices() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    listNotices(0, 5)
      .then((page) => setNotices(page.content))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="fl-card-head">
        <span className="fl-card-title">최근 공지사항</span>
        <Link to="/notices" className="fl-link">
          전체보기 →
        </Link>
      </div>

      <div className="fl-card-body fl-flush">
        {loading && <div className="fl-empty">불러오는 중...</div>}

        {!loading && notices.length === 0 && <div className="fl-empty">공지사항이 없습니다.</div>}

        {!loading &&
          notices.map((notice) => (
            <Link key={notice.id} to={`/notice/${notice.id}`} className="fl-linkrow">
              <span className="fl-dot" />
              <span className="fl-linkrow-title">{notice.title}</span>
              <span className="fl-linkrow-date">{formatShortDate(notice.createdAt)}</span>
            </Link>
          ))}
      </div>
    </>
  )
}
