import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listNotices } from '../api/notices'
import { isAdmin } from '../auth/token'

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

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
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
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{ 
        maxWidth: 900, 
        width: '100%', 
        margin: '0 auto',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          marginBottom: 12,
          position: 'relative',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 8 : 0
        }}>
          <h1 className="title" style={{ margin: 0 }}>공지사항</h1>
          {isAdmin() && <Link className="btn btn-create" to="/notice/new" style={{ position: isMobile ? 'relative' : 'absolute', right: isMobile ? 'auto' : 0, top: isMobile ? 'auto' : 0, fontSize: isMobile ? '14px' : '16px' }}>✨ 새 공지</Link>}
        </div>
        <div style={{ 
          display: 'flex', 
          gap: 8, 
          alignItems: 'center', 
          marginBottom: 12,
          flexDirection: isMobile ? 'column' : 'row',
          width: '100%',
          overflow: 'hidden'
        }}>
          <input 
            className="input" 
            placeholder="검색어" 
            value={q} 
            onChange={(e) => setQ(e.target.value)} 
            style={{ flex: isMobile ? '1 1 0' : 1, width: isMobile ? '100%' : 'auto', minWidth: 0, boxSizing: 'border-box' }} 
          />
          <button className="btn ghost" onClick={onSearch} disabled={loading} style={{ whiteSpace: 'nowrap', width: isMobile ? '100%' : 'auto', boxSizing: 'border-box' }}>검색</button>
        </div>

        <div className="card" style={{ padding: 0 }}>
          {isMobile ? (
            // 모바일 레이아웃
            <>
              {items.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>게시글이 없습니다.</div>
              )}
              {items.map((n, idx) => (
                <div key={n.id} style={{
                  padding: '16px',
                  borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <span style={{ 
                      color: 'var(--muted)', 
                      fontSize: '12px' 
                    }}>#{startNumber - idx}</span>
                    <span style={{ 
                      color: 'var(--muted)', 
                      fontSize: '12px' 
                    }}>{formatDate(n.createdAt)}</span>
                  </div>
                  <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                    <Link className="link-plain" to={`/notice/${n.id}`}>{n.title}</Link>
                  </div>
                  <div style={{ 
                    color: 'var(--muted)', 
                    fontSize: '14px' 
                  }}>
                    작성자: {n.authorDisplayName || n.authorUsername}
                  </div>
                </div>
              ))}
            </>
          ) : (
            // 데스크톱 레이아웃
            <>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '80px 1fr 180px 180px', 
                gap: 16, 
                padding: '12px 16px', 
                borderBottom: '1px solid var(--border)', 
                color: 'var(--muted)', 
                fontSize: 14,
                fontWeight: 500
              }}>
                <div style={{ textAlign: 'center' }}>번호</div>
                <div>제목</div>
                <div style={{ textAlign: 'center' }}>작성자</div>
                <div style={{ textAlign: 'center' }}>작성일</div>
              </div>
              {items.length === 0 && (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>게시글이 없습니다.</div>
              )}
              {items.map((n, idx) => (
                <div key={n.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 180px 180px',
                  alignItems: 'center',
                  gap: 16,
                  padding: '12px 16px',
                  borderBottom: idx < items.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background-color 0.2s ease'
                }}>
                  <div style={{ 
                    textAlign: 'center',
                    fontSize: '14px',
                    fontWeight: 500,
                    color: 'var(--muted)'
                  }}>
                    {startNumber - idx}
                  </div>
                  <div style={{ 
                    overflow: 'hidden', 
                    whiteSpace: 'nowrap', 
                    textOverflow: 'ellipsis',
                    paddingLeft: 8
                  }}>
                    <Link className="link-plain" to={`/notice/${n.id}`}>{n.title}</Link>
                  </div>
                  <div style={{ 
                    color: 'var(--muted)', 
                    textAlign: 'center',
                    fontSize: '14px'
                  }}>
                    {n.authorDisplayName || n.authorUsername}
                  </div>
                  <div style={{ 
                    color: 'var(--muted)', 
                    textAlign: 'center',
                    fontSize: '14px'
                  }}>
                    {formatDate(n.createdAt)}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 8, 
          marginTop: 12,
          flexWrap: 'wrap'
        }}>
          <button className="btn ghost" onClick={() => go(page - 1)} disabled={page <= 0}>이전</button>
          {Array.from({ length: totalPages }).slice(0, isMobile ? 5 : 7).map((_, i) => {
            const p = i
            return (
              <button key={p} className="btn ghost" onClick={() => go(p)} disabled={p === page}>{p + 1}</button>
            )
          })}
          <button className="btn ghost" onClick={() => go(page + 1)} disabled={page >= totalPages - 1}>다음</button>
        </div>
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


