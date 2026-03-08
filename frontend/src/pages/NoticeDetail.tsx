import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addComment, getNotice, listComments, deleteNotice, deleteComment, type Notice, type NoticeComment } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'
import { formatDateTime } from '../utils/formatDate'
import CommentNode, { type CommentNodeData } from '../components/CommentNode'
import '../styles/notices.css'

function buildCommentTree(flatComments: NoticeComment[]): CommentNodeData[] {
  const map = new Map<number, CommentNodeData>()
  const roots: CommentNodeData[] = []

  flatComments.forEach((c) => map.set(c.id, { ...c, replies: [] }))

  flatComments.forEach((c) => {
    const node = map.get(c.id)!
    if (c.parentId != null && map.has(c.parentId)) {
      const parent = map.get(c.parentId)!
      if (parent.parentId === null) {
        parent.replies.push(node)
      } else {
        roots.push(node)
      }
    } else if (c.parentId == null) {
      roots.push(node)
    }
  })

  const sortByTime = (nodes: CommentNodeData[]) => {
    nodes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    nodes.forEach((n) => sortByTime(n.replies))
  }
  sortByTime(roots)

  return roots
}

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()

  const [notice, setNotice] = useState<Notice | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [comments, setComments] = useState<NoticeComment[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!noticeId) return
    getNotice(noticeId)
      .then(setNotice)
      .catch(() => setNotFound(true))
    listComments(noticeId).then(setComments)
  }, [noticeId])

  async function refreshComments() {
    const cs = await listComments(noticeId)
    setComments(cs)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!text.trim()) {
      setError('댓글을 입력해주세요.')
      return
    }
    try {
      setSubmitting(true)
      await addComment(noticeId, { content: text })
      setText('')
      await refreshComments()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function onReply(nid: number, parentId: number, content: string) {
    await addComment(nid, { content, parentId })
    await refreshComments()
  }

  async function onCommentDelete(commentId: number) {
    if (!window.confirm('이 댓글을 삭제하시겠습니까?')) return
    try {
      await deleteComment(noticeId, commentId)
      await refreshComments()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  async function onDelete() {
    if (!noticeId) return
    if (!window.confirm('이 게시글을 삭제하시겠습니까?')) return
    try {
      await deleteNotice(noticeId)
      navigate('/notices')
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  if (notFound) {
    return (
      <div className="notice-container">
        <div className="notice-panel">
          <div className="notice-empty">
            <div className="notice-empty-icon">🔍</div>
            존재하지 않는 게시글입니다.
            <div style={{ marginTop: 16 }}>
              <Link className="btn ghost" to="/notices">목록으로</Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isUpdated = notice
    ? Math.abs(new Date(notice.updatedAt).getTime() - new Date(notice.createdAt).getTime()) > 1000
    : false

  const commentTree = buildCommentTree(comments)

  return (
    <div className="notice-container">
      <div className="notice-panel">
        <div className="notice-detail-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Link className="btn ghost" to="/notices">← 목록</Link>
            {notice && (isAdmin() || getUsername() === notice.authorUsername) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link className="btn btn-edit" to={`/notice/${noticeId}/edit`}>수정</Link>
                <button className="btn btn-delete" onClick={onDelete}>삭제</button>
              </div>
            )}
          </div>

          {notice && (
            <>
              <h1 className="notice-detail-title">{notice.title}</h1>
              <div className="notice-detail-meta">
                <span>{notice.authorDisplayName || notice.authorUsername}</span>
                <span>·</span>
                <time>{formatDateTime(notice.createdAt)}</time>
                {isUpdated && (
                  <>
                    <span>·</span>
                    <span>수정됨: {formatDateTime(notice.updatedAt)}</span>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {notice && (
          <div className="notice-content">{notice.content}</div>
        )}

        <div className="comments-section">
          <div className="comments-header">
            댓글 <span style={{ color: 'var(--primary)', fontSize: '0.9em' }}>{comments.length}</span>
          </div>

          {isAuthenticated() && (
            <form className="comment-form" onSubmit={onSubmit}>
              <textarea
                className="comment-input"
                placeholder="댓글을 남겨보세요..."
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                rows={3}
              />
              <div className="comment-actions">
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{text.length}/500</span>
                <button
                  className="btn btn-submit"
                  type="submit"
                  disabled={!text.trim() || submitting}
                  style={{ padding: '8px 24px', minWidth: 'auto' }}
                >
                  {submitting ? '등록 중...' : '댓글 등록'}
                </button>
              </div>
              {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
            </form>
          )}

          <div className="comment-tree">
            {comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--muted)' }}>
                첫 번째 댓글을 남겨보세요!
              </div>
            ) : (
              commentTree.map((root) => (
                <CommentNode
                  key={root.id}
                  node={root}
                  noticeId={noticeId}
                  onReply={onReply}
                  onDelete={onCommentDelete}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
