import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addComment, getNotice, listComments, deleteNotice, deleteComment } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'
import '../styles/notices.css'

interface Comment {
  id: number
  content: string
  authorUsername: string
  parentId: number | null
  createdAt: string
}

interface CommentNode extends Comment {
  replies: CommentNode[]
}

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()
  const [notice, setNotice] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    if (!noticeId) return
    getNotice(noticeId).then(setNotice)
    listComments(noticeId).then(setComments)
  }, [noticeId])



  function buildCommentTree(flatComments: Comment[]): CommentNode[] {
    const map = new Map<number, CommentNode>()
    const roots: CommentNode[] = []

    flatComments.forEach(comment => {
      map.set(comment.id, { ...comment, replies: [] })
    })

    flatComments.forEach(comment => {
      const node = map.get(comment.id)!
      if (comment.parentId && map.has(comment.parentId)) {
        const parentNode = map.get(comment.parentId)!
        if (parentNode.parentId === null) {
          parentNode.replies.push(node)
        } else {
          roots.push(node)
        }
      } else if (!comment.parentId) {
        roots.push(node)
      }
    })

    const sortByTime = (nodes: CommentNode[]) => {
      nodes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      nodes.forEach(node => sortByTime(node.replies))
    }
    sortByTime(roots)

    return roots
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
      const cs = await listComments(noticeId)
      setComments(cs)
    } catch (err: any) {
      setError(err.message || 'failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onReplySubmit(e: React.FormEvent, parentCommentId: number) {
    e.preventDefault()
    setError('')
    if (!replyText.trim()) {
      setError('답글을 입력해주세요.')
      return
    }
    try {
      setSubmitting(true)
      await addComment(noticeId, { content: replyText, parentId: parentCommentId })
      setReplyText('')
      setReplyingTo(null)
      const cs = await listComments(noticeId)
      setComments(cs)
    } catch (err: any) {
      setError(err.message || 'failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function onCommentDelete(commentId: number) {
    if (!confirm('이 댓글을 삭제하시겠습니까?')) return
    try {
      await deleteComment(noticeId, commentId)
      const cs = await listComments(noticeId)
      setComments(cs)
    } catch (err: any) {
      alert(err.message || '삭제 실패')
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

  const commentTree = buildCommentTree(comments)

  const renderCommentNode = (node: CommentNode, depth: number = 0) => {
    const isReply = depth > 0

    return (
      <div key={node.id} className="comment-node">
        <div className={`comment-card ${isReply ? 'reply' : ''}`}>
          <div className="comment-header">
            <span className="comment-author">
              {isReply && '↳ '}
              {node.authorUsername}
            </span>
            <span className="comment-date">{formatDateTime(node.createdAt)}</span>
          </div>
          
          <div className="comment-body">
            {node.content}
          </div>

          <div className="comment-footer">
            {isAuthenticated() && !isReply && (
              <button
                className="btn-text"
                onClick={() => setReplyingTo(replyingTo === node.id ? null : node.id)}
              >
                {replyingTo === node.id ? '취소' : '답글'}
              </button>
            )}
            {isAuthenticated() && (isAdmin() || getUsername() === node.authorUsername) && (
              <button
                className="btn-text danger"
                onClick={() => onCommentDelete(node.id)}
              >
                삭제
              </button>
            )}
          </div>

          {replyingTo === node.id && isAuthenticated() && (
            <form onSubmit={(e) => onReplySubmit(e, node.id)} style={{ marginTop: 16 }}>
              <textarea
                className="comment-input"
                placeholder="답글을 입력하세요..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                rows={3}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', padding: 12, borderRadius: 8 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => {
                    setReplyingTo(null)
                    setReplyText('')
                  }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-submit"
                  disabled={!replyText.trim() || submitting}
                  style={{ padding: '8px 16px', minWidth: 'auto' }}
                >
                  {submitting ? '...' : '등록'}
                </button>
              </div>
            </form>
          )}
        </div>

        {node.replies.length > 0 && (
          <div className="comment-replies">
            {node.replies.map((reply) => renderCommentNode(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="notice-container">
      <div className="notice-panel">
        <div className="notice-detail-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Link className="btn ghost" to="/notices">
              ← 목록
            </Link>
            {notice && (isAdmin() || getUsername() === notice.authorUsername) && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Link className="btn btn-edit" to={`/notice/${noticeId}/edit`}>
                  수정
                </Link>
                <button className="btn btn-delete" onClick={onDelete}>
                  삭제
                </button>
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
                {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
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
          <div className="notice-content">
            {notice.content}
          </div>
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
              commentTree.map((rootComment) => renderCommentNode(rootComment))
            )}
          </div>
        </div>
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


