import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listNotices } from '../api/notices'
import { isAdmin } from '../auth/token'
import '../styles/notices.css'

export default function NoticesPage() {
  const [items, setItems] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  async function load(p = page, s = size) {
    setLoading(true)
    try {
      const resp: any = await listNotices(p, s, q)
      setItems(resp.content || [])
      setTotalElements(resp.totalElements || 0)
      setTotalPages(resp.totalPages || 0)
      setPage(resp.number || p)
      setSize(resp.size || s)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(0, size) }, [])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function onSearch() {
    load(0, size)
  }

  function go(p: number) {
    if (p < 0 || p >= totalPages) return
    load(p, size)
  }

  const startNumber = totalElements - page * size

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
          {!isMobile && (
            <div className="notice-list-header">
              <div style={{ textAlign: 'center' }}>번호</div>
              <div>제목</div>
              <div style={{ textAlign: 'center' }}>작성자</div>
              <div style={{ textAlign: 'center' }}>작성일</div>
            </div>
          )}

          {items.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--muted)' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
              게시글이 없습니다.
            </div>
          ) : (
            items.map((n, idx) => (
              isMobile ? (
                <Link key={n.id} to={`/notice/${n.id}`} className="notice-mobile-item link-plain">
                  <div className="notice-mobile-header">
                    <span>#{startNumber - idx}</span>
                    <span>{formatDate(n.createdAt)}</span>
                  </div>
                  <div className="notice-mobile-title">{n.title}</div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {n.authorDisplayName || n.authorUsername}
                  </div>
                </Link>
              ) : (
                <Link key={n.id} to={`/notice/${n.id}`} className="notice-item">
                  <div className="notice-item-id">{startNumber - idx}</div>
                  <div className="notice-item-title">{n.title}</div>
                  <div className="notice-item-author">{n.authorDisplayName || n.authorUsername}</div>
                  <div className="notice-item-date">{formatDate(n.createdAt)}</div>
                </Link>
              )
            ))
          )}
        </div>

        {totalPages > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 24 }}>
            <button className="btn ghost" onClick={() => go(page - 1)} disabled={page <= 0}>
              이전
            </button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 12px', color: 'var(--muted)' }}>
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

function formatDate(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleDateString()
  } catch {
    return iso
  }
}


