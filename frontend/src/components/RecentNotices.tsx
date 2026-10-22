import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listNotices, type NoticeSummary } from '../api/notices'

// 목록에는 MM.DD만 노출한다 (연도와 작성자는 공지사항 페이지에서 확인)
function formatShortDate(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${m}.${day}`
}

export default function RecentNotices() {
  const [notices, setNotices] = useState<NoticeSummary[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)
  const requestRef = useRef<ReturnType<typeof listNotices> | null>(null)

  useEffect(() => {
    let active = true
    // 고정 공지는 페이징 밖으로 빠져 따로 내려오므로 앞에 붙여 준다.
    // 여기서 page.content만 보면 상단 고정한 공지가 대시보드에서 빠진다.
    requestRef.current ??= listNotices(0, 5)
    requestRef.current
      .then((resp) => {
        if (active) setNotices([...resp.pinned, ...resp.page.content].slice(0, 5))
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : '공지사항을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [retryKey])

  function retry() {
    requestRef.current = null
    setError('')
    setLoading(true)
    setRetryKey((key) => key + 1)
  }

  return (
    <>
      <div className="fl-card-head">
        <span className="fl-card-title">최근 공지사항</span>
        <Link to="/notices" className="fl-link">
          전체보기 →
        </Link>
      </div>

      <div className="fl-card-body fl-flush">
        {!loading && error && (
          <div className="fl-empty" role="alert">
            <p>{error}</p>
            <button className="fl-btn fl-btn-sm" onClick={retry}>
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && notices.length === 0 && <div className="fl-empty">공지사항이 없습니다.</div>}

        {!loading && !error &&
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
