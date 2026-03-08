import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listNotices, type Notice } from '../api/notices'
import { isAdmin } from '../auth/token'
import { formatDate } from '../utils/formatDate'
import '../styles/notices.css'

const PAGE_SIZE = 10

export default function NoticesPage() {
  const [items, setItems] = useState<Notice[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p: number, query: string) => {
    setLoading(true)
    try {
      const resp = await listNotices(p, PAGE_SIZE, query)
      setItems(resp.content)
      setTotalElements(resp.totalElements)
      setTotalPages(resp.totalPages)
      setPage(resp.number)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(0, q)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onSearch() {
    load(0, q)
  }

  function go(p: number) {
    if (p < 0 || p >= totalPages) return
    load(p, q)
  }

  const startNumber = totalElements - page * PAGE_SIZE

  return (
    <div className="notice-container">
      <div className="notice-panel">
        <div className="notice-header">
          <h1 className="notice-title">공지사항</h1>
          {isAdmin() && (
            <Link className="btn btn-create" to="/notice/new">
              ✨ 새 공지
            </Link>
          )}
        </div>

        <div className="notice-search">
          <input
            placeholder="검색어를 입력하세요..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          />
          <button className="btn ghost" onClick={onSearch} disabled={loading}>
            검색
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="notice-list-header">
            <div style={{ textAlign: 'center' }}>번호</div>
            <div>제목</div>
            <div style={{ textAlign: 'center' }}>작성자</div>
            <div style={{ textAlign: 'center' }}>작성일</div>
          </div>

          {loading && (
            <div className="notice-empty">불러오는 중...</div>
          )}

          {!loading && items.length === 0 && (
            <div className="notice-empty">
              <div className="notice-empty-icon">📭</div>
              게시글이 없습니다.
            </div>
          )}

          {!loading && items.map((n, idx) => (
            <Link key={n.id} to={`/notice/${n.id}`} className="notice-item notice-mobile-item link-plain">
              {/* 데스크톱 레이아웃 */}
              <div className="notice-item-id">{startNumber - idx}</div>
              <div className="notice-item-title">{n.title}</div>
              <div className="notice-item-author">{n.authorDisplayName || n.authorUsername}</div>
              <div className="notice-item-date">{formatDate(n.createdAt)}</div>

              {/* 모바일 레이아웃 */}
              <div className="notice-mobile-header">
                <span>#{startNumber - idx}</span>
                <span>{formatDate(n.createdAt)}</span>
              </div>
              <div className="notice-mobile-title">{n.title}</div>
              <div className="notice-mobile-author">{n.authorDisplayName || n.authorUsername}</div>
            </Link>
          ))}
        </div>

        {totalPages > 0 && (
          <div className="notice-pagination">
            <button className="btn ghost" onClick={() => go(page - 1)} disabled={page <= 0}>
              이전
            </button>
            <span className="notice-pagination-info">
              {page + 1} / {totalPages}
            </span>
            <button className="btn ghost" onClick={() => go(page + 1)} disabled={page >= totalPages - 1}>
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
