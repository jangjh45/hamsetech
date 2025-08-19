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

  function onSearch() {
    load(0, size)
  }

  function go(p: number) {
    if (p < 0 || p >= totalPages) return
    load(p, size)
  }

  const startNumber = totalElements - page * size

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 900, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 className="title" style={{ margin: 0 }}>공지사항</h1>
          {isAdmin() && <Link className="btn ghost" to="/notice/new">새 공지</Link>}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
          <input className="input" placeholder="검색어" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          <button className="btn ghost" onClick={onSearch} disabled={loading}>검색</button>
        </div>

          <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 160px 160px', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 14 }}>
            <div style={{ textAlign: 'right', paddingRight: 8 }}>번호</div>
            <div>제목</div>
            <div>작성자</div>
            <div>작성일</div>
          </div>
          {items.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>게시글이 없습니다.</div>
          )}
          {items.map((n, idx) => (
            <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 160px 160px', alignItems: 'center', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ textAlign: 'right', paddingRight: 8 }}>{startNumber - idx}</div>
              <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                <Link className="link-plain" to={`/notice/${n.id}`}>{n.title}</Link>
              </div>
              <div style={{ color: 'var(--muted)' }}>{n.authorDisplayName || n.authorUsername}</div>
              <div style={{ color: 'var(--muted)' }}>{formatDate(n.createdAt)}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
          <button className="btn ghost" onClick={() => go(page - 1)} disabled={page <= 0}>이전</button>
          {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
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


