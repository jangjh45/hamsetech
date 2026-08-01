import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listNotices, type Notice } from '../api/notices'
import { isAdmin } from '../auth/token'
import { formatDate } from '../utils/formatDate'
import Pager from '../components/Pager'
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
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>공지사항</h1>
          <p>전체 {totalElements}건</p>
        </div>
        {isAdmin() && (
          <Link className="fl-btn fl-btn-primary" to="/notice/new">
            공지 등록
          </Link>
        )}
      </div>

      <section className="fl-card">
        <div className="fl-card-head">
          <span className="fl-card-title">전체 목록</span>
          <div className="nt-search">
            <input
              className="fl-input"
              placeholder="제목 · 작성자 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <button className="fl-btn" onClick={onSearch} disabled={loading}>
              검색
            </button>
          </div>
        </div>

        <div className="fl-card-body fl-flush">
          <div className="nt-table-head">
            <div>번호</div>
            <div>제목</div>
            <div>작성자</div>
            <div style={{ textAlign: 'right' }}>등록일</div>
          </div>

          {loading && <div className="fl-empty">불러오는 중...</div>}

          {!loading && items.length === 0 && <div className="fl-empty">게시글이 없습니다.</div>}

          {!loading &&
            items.map((n, idx) => {
              const num = startNumber - idx
              const author = n.authorDisplayName || n.authorUsername
              return (
                <Link key={n.id} to={`/notice/${n.id}`} className="nt-row">
                  <span className="nt-row-num">{num}</span>
                  <span className="nt-row-title">{n.title}</span>
                  <span className="nt-row-author">{author}</span>
                  <span className="nt-row-date">{formatDate(n.createdAt)}</span>
                  {/* 모바일에서만 보이는 요약 줄 (번호·작성자·날짜) */}
                  <span className="nt-row-meta">
                    <span>#{num}</span>
                    <span>·</span>
                    <span>{author}</span>
                    <span>·</span>
                    <span>{formatDate(n.createdAt)}</span>
                  </span>
                </Link>
              )
            })}
        </div>

        <Pager page={page} totalPages={totalPages} onChange={go} disabled={loading} />
      </section>
    </div>
  )
}
