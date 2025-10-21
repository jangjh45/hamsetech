import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addComment, getNotice, listComments, deleteNotice, deleteComment } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'

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
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [submitting, setSubmitting] = useState(false)
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    if (!noticeId) return
    getNotice(noticeId).then(setNotice)
    listComments(noticeId).then(setComments)
  }, [noticeId])

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 댓글을 트리 구조로 변환 (1단계 대댓글만 지원)
  function buildCommentTree(flatComments: Comment[]): CommentNode[] {
    const map = new Map<number, CommentNode>()
    const roots: CommentNode[] = []

    // 1단계: 모든 댓글을 맵에 추가
    flatComments.forEach(comment => {
      map.set(comment.id, { ...comment, replies: [] })
    })

    // 2단계: 부모-자식 관계 설정
    // 규칙: parentId가 null인 댓글만 루트, parentId가 루트 댓글을 가리키면 자식
    // 예: 대댓글의 대댓글은 형제로 표시 (깊이 제한)
    flatComments.forEach(comment => {
      const node = map.get(comment.id)!
      if (comment.parentId && map.has(comment.parentId)) {
        const parentNode = map.get(comment.parentId)!
        // 부모가 루트(parentId === null)면 자식으로 추가, 아니면 형제로 추가
        if (parentNode.parentId === null) {
          parentNode.replies.push(node)
        } else {
          roots.push(node)
        }
      } else if (!comment.parentId) {
        roots.push(node)
      }
    })

    // 3단계: 시간순으로 정렬 (생성 시간 오름차순)
    const sortByTime = (nodes: CommentNode[]) => {
      nodes.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime()
        const timeB = new Date(b.createdAt).getTime()
        return timeA - timeB
      })
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

  // 댓글 렌더링 함수 (재귀)
  const renderCommentNode = (node: CommentNode, depth: number = 0) => {
    const isReply = depth > 0
    const marginLeft = isReply ? depth * 24 : 0

    return (
      <div key={node.id}>
        <div
          className="card"
          style={{
            padding: isMobile ? 12 : 16,
            border: '1px solid var(--border)',
            marginLeft: marginLeft,
            backgroundColor: isReply ? 'var(--bg-hover)' : 'transparent',
            marginBottom: isMobile ? 8 : 12,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 8 : 8,
            }}
          >
            <div
              style={{
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontSize: isMobile ? '14px' : '15px',
                marginBottom: isMobile ? 8 : 0,
              }}
            >
              {node.content}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: isMobile ? '12px' : '13px',
                  color: 'var(--muted)',
                }}
              >
                {isReply && '↳ '}
                by {node.authorUsername}
              </span>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {isAuthenticated() && !isReply && (
                  <button
                    className="btn ghost"
                    onClick={() => setReplyingTo(replyingTo === node.id ? null : node.id)}
                    style={{
                      fontSize: isMobile ? '12px' : '13px',
                      padding: '4px 8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--primary)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    {replyingTo === node.id ? '✕ 취소' : '↳ 답글'}
                  </button>
                )}
                {isAuthenticated() && (isAdmin() || getUsername() === node.authorUsername) && (
                  <button
                    className="btn ghost"
                    onClick={() => onCommentDelete(node.id)}
                    style={{
                      fontSize: isMobile ? '12px' : '13px',
                      padding: '4px 8px',
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--danger)',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    🗑️ 삭제
                  </button>
                )}
              </div>
            </div>

            {/* 답글 작성 폼 */}
            {replyingTo === node.id && isAuthenticated() && (
              <form
                onSubmit={(e) => onReplySubmit(e, node.id)}
                style={{
                  marginTop: 12,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <textarea
                  className="input"
                  placeholder="답글을 입력하세요..."
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
                  rows={isMobile ? 3 : 4}
                  style={{
                    resize: 'vertical',
                    fontSize: isMobile ? 14 : 15,
                    padding: isMobile ? '10px 12px' : '12px 16px',
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    boxSizing: 'border-box',
                  }}
                />
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    justifyContent: 'flex-end',
                    fontSize: isMobile ? '12px' : '13px',
                  }}
                >
                  <span style={{ color: 'var(--muted)' }}>{replyText.length}/500자</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="submit"
                      className="btn btn-submit"
                      disabled={!replyText.trim() || submitting}
                      style={{
                        fontSize: isMobile ? '12px' : '13px',
                        padding: '6px 12px',
                      }}
                    >
                      {submitting ? '⏳' : '✓'} 답글
                    </button>
                    <button
                      type="button"
                      className="btn ghost"
                      onClick={() => {
                        setReplyingTo(null)
                        setReplyText('')
                      }}
                      style={{
                        fontSize: isMobile ? '12px' : '13px',
                        padding: '6px 12px',
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* 대댓글 재귀 렌더링 */}
        {node.replies.length > 0 && (
          <div style={{ marginLeft: isMobile ? 12 : 16 }}>
            {node.replies.map((reply) => renderCommentNode(reply, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className="container"
      style={{
        padding: isMobile ? '16px' : '24px',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        className="panel"
        style={{
          maxWidth: 820,
          width: '100%',
          margin: '0 auto',
          textAlign: isMobile ? 'center' : 'left',
          boxSizing: 'border-box',
          padding: isMobile ? '16px' : '20px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 12 : 12,
            flexWrap: 'wrap',
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
          <Link
            className="btn ghost"
            to="/notices"
            style={{
              display: 'inline-block',
              fontSize: isMobile ? 14 : 16,
              padding: '10px 16px',
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            ← 목록으로
          </Link>
          {notice && (isAdmin() || getUsername() === notice.authorUsername) && (
            <div
              style={{
                display: 'flex',
                gap: isMobile ? 8 : 8,
                flexDirection: isMobile ? 'row' : 'row',
                width: isMobile ? '100%' : 'auto',
                justifyContent: isMobile ? 'space-between' : 'flex-end',
              }}
            >
              <Link
                className="btn btn-edit"
                to={`/notice/${noticeId}/edit`}
                style={{
                  width: isMobile ? '48%' : 'auto',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 16px' : '12px 20px',
                  textAlign: 'center',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                ✏️ 수정
              </Link>
              <button
                className="btn btn-delete"
                onClick={onDelete}
                style={{
                  width: isMobile ? '48%' : 'auto',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 16px' : '12px 20px',
                  textAlign: 'center',
                  flex: isMobile ? 1 : 'none',
                }}
              >
                🗑️ 삭제
              </button>
            </div>
          )}
        </div>
        {notice && (
          <>
            <h1
              className="title"
              style={{
                marginBottom: 8,
                textAlign: isMobile ? 'center' : 'left',
                fontSize: isMobile ? '24px' : '32px',
                lineHeight: 1.3,
              }}
            >
              {notice.title}
            </h1>
            <div
              className="meta"
              style={{
                marginBottom: 16,
                textAlign: isMobile ? 'center' : 'left',
                fontSize: isMobile ? '13px' : '14px',
                lineHeight: 1.5,
                color: 'var(--muted)',
              }}
            >
              <span>작성자: {notice.authorDisplayName || notice.authorUsername}</span>
              <span style={{ margin: '0 8px' }}>·</span>
              <time>{formatDateTime(notice.createdAt)}</time>
              {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
                <>
                  <span style={{ margin: '0 8px' }}>·</span>
                  <span>수정됨: {formatDateTime(notice.updatedAt)}</span>
                </>
              )}
            </div>
            <div
              className="card"
              style={{
                padding: isMobile ? 16 : 20,
                margin: '0 0 24px 0',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.7,
                fontSize: isMobile ? '15px' : '16px',
                minHeight: '100px',
              }}
            >
              {notice.content}
            </div>
          </>
        )}
        <h3
          style={{
            marginTop: 0,
            marginBottom: 16,
            textAlign: isMobile ? 'center' : 'left',
            fontSize: isMobile ? '20px' : '24px',
            fontWeight: 600,
          }}
        >
          댓글 ({comments.length})
        </h3>
        <div className="grid" style={{ gap: isMobile ? 12 : 16 }}>
          {comments.length === 0 ? (
            <div
              style={{
                padding: isMobile ? 20 : 24,
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: isMobile ? '14px' : '16px',
              }}
            >
              아직 댓글이 없습니다.
            </div>
          ) : (
            commentTree.map((rootComment) => renderCommentNode(rootComment))
          )}
        </div>
        {isAuthenticated() && (
          <form
            className="form"
            onSubmit={onSubmit}
            style={{
              marginTop: 24,
              width: '100%',
              maxWidth: '100%',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                marginBottom: 12,
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                <label
                  style={{
                    display: 'block',
                    fontSize: isMobile ? '14px' : '16px',
                    fontWeight: 500,
                    textAlign: isMobile ? 'center' : 'left',
                  }}
                >
                  댓글 작성
                </label>
                <span
                  style={{
                    fontSize: '13px',
                    color: 'var(--muted)',
                    textAlign: 'right',
                  }}
                >
                  {text.length}/500자
                </span>
              </div>
              <textarea
                className="input"
                placeholder="댓글을 입력하세요..."
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 500))}
                rows={isMobile ? 4 : 5}
                style={{
                  resize: 'vertical',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 16px' : '16px 20px',
                  width: '100%',
                  maxWidth: '100%',
                  minHeight: isMobile ? '100px' : '120px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: isMobile ? 'center' : 'flex-end',
                marginTop: 16,
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
              }}
            >
              <button
                className="btn btn-submit"
                type="submit"
                disabled={!text.trim() || submitting}
                style={{
                  width: isMobile ? '100%' : 'auto',
                  fontSize: isMobile ? 14 : 16,
                  maxWidth: isMobile ? '100%' : 'none',
                  boxSizing: 'border-box',
                }}
              >
                {submitting ? '⏳ 등록 중...' : '✓ 댓글 등록'}
              </button>
            </div>
            {error && (
              <p
                className="error"
                style={{
                  fontSize: isMobile ? 12 : 14,
                  textAlign: isMobile ? 'center' : 'left',
                  marginTop: 12,
                  padding: '8px 12px',
                  backgroundColor: 'var(--danger-bg)',
                  border: '1px solid var(--danger)',
                  borderRadius: '6px',
                  width: '100%',
                  maxWidth: '100%',
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  wordWrap: 'break-word',
                }}
              >
                {error}
              </p>
            )}
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


