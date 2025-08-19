import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addComment, getNotice, listComments, deleteNotice } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()
  const [notice, setNotice] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!noticeId) return
    getNotice(noticeId).then(setNotice)
    listComments(noticeId).then(setComments)
  }, [noticeId])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await addComment(noticeId, { content: text })
      setText('')
      const cs = await listComments(noticeId)
      setComments(cs)
    } catch (err: any) {
      setError(err.message || 'failed')
    }
  }

  async function onDelete() {
    if (!noticeId) return
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return
    try {
      await deleteNotice(noticeId)
      navigate('/notices')
    } catch (err: any) {
      alert(err.message || '삭제 실패')
    }
  }

  return (
    <div className="container">
      <div className="panel" style={{ maxWidth: 820, width: '100%', margin: '0 auto', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Link className="btn ghost" to="/notices">목록으로</Link>
          {(notice && (isAdmin() || getUsername() === notice.authorUsername)) && (
            <div style={{ display: 'flex', gap: 8 }}>
              <Link className="btn ghost" to={`/notice/${noticeId}/edit`}>수정</Link>
              <button className="btn ghost" onClick={onDelete}>삭제</button>
            </div>
          )}
        </div>
        {notice && (
          <>
            <h1 className="title" style={{ marginBottom: 6 }}>{notice.title}</h1>
            <div className="meta" style={{ marginBottom: 12 }}>
              <span>작성자 {notice.authorDisplayName || notice.authorUsername}</span>
              <span>·</span>
              <time>{formatDateTime(notice.createdAt)}</time>
              {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
                <>
                  <span>·</span>
                  <span>수정됨 {formatDateTime(notice.updatedAt)}</span>
                </>
              )}
            </div>
            <div className="card" style={{ padding: 16, margin: '8px 0 16px', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {notice.content}
            </div>
          </>
        )}
        <h3 style={{ marginTop: 24, marginBottom: 8 }}>댓글</h3>
        <div className="grid" style={{ gap: 12 }}>
          {comments.map((c) => (
            <div key={c.id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
                <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{c.content}</div>
                <div className="subtitle" style={{ margin: 0, whiteSpace: 'nowrap' }}>by {c.authorUsername}</div>
              </div>
            </div>
          ))}
        </div>
        {isAuthenticated() && (
          <form className="form" onSubmit={onSubmit} style={{ marginTop: 16 }}>
            <textarea
              className="input"
              placeholder="댓글을 입력하세요"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              style={{ resize: 'vertical' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn ghost" type="submit">댓글 등록</button>
            </div>
            {error && <p className="error">{error}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

function formatDateTime(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}


