import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addComment,
  getNotice,
  getNoticeNeighbors,
  listComments,
  deleteNotice,
  deleteComment,
  NOTICE_CATEGORY_LABELS,
  type NoticeDetail,
  type NoticeNeighbors,
  type NoticeComment,
} from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'
import { formatDateTime } from '../utils/formatDate'
import CommentNode, { type CommentNodeData } from '../components/CommentNode'
import NoticeHtmlView from '../components/NoticeHtmlView'
import NoticeAttachmentList from '../components/NoticeAttachmentList'
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

  const [notice, setNotice] = useState<NoticeDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [comments, setComments] = useState<NoticeComment[]>([])
  const [neighbors, setNeighbors] = useState<NoticeNeighbors>({ prev: null, next: null })
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

  // 이전·다음 글은 부가 정보라 실패해도 조용히 넘긴다.
  useEffect(() => {
    if (!noticeId) return
    let cancelled = false
    getNoticeNeighbors(noticeId)
      .then((n) => {
        if (!cancelled) setNeighbors(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
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
      <div className="fl-page">
        <section className="fl-card">
          <div className="fl-card-body">
            <div className="fl-empty">존재하지 않는 게시글입니다.</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link className="fl-btn" to="/notices">
                목록으로
              </Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  const isUpdated = notice
    ? Math.abs(new Date(notice.updatedAt).getTime() - new Date(notice.createdAt).getTime()) > 1000
    : false

  const author = notice ? notice.authorDisplayName || notice.authorUsername : ''
  const canEdit = !!notice && (isAdmin() || getUsername() === notice.authorUsername)
  const commentTree = buildCommentTree(comments)

  return (
    <div className="fl-page">
      <div className="nt-crumb">
        <Link to="/notices">공지사항</Link>
        <span className="nt-crumb-sep">/</span>
        <span>상세</span>
      </div>

      <div className="nt-detail-grid">
        <section className="fl-card">
          <div className="nt-article-head">
            <h1 className="nt-article-title">{notice ? notice.title : '불러오는 중...'}</h1>
            {notice && (
              <div className="nt-article-meta">
                <span className="nt-badge-cat">{NOTICE_CATEGORY_LABELS[notice.category]}</span>
                {notice.pinned && <span className="nt-badge-pin">공지</span>}
                <span className="nt-meta-sep" />
                <span className="nt-article-meta-author">
                  <span className="nt-avatar-sm">{author.charAt(0)}</span>
                  {author}
                </span>
                <span className="nt-meta-sep" />
                <time>{formatDateTime(notice.createdAt)}</time>
                {isUpdated && (
                  <>
                    <span className="nt-meta-sep" />
                    <span className="nt-tnum">수정됨 {formatDateTime(notice.updatedAt)}</span>
                  </>
                )}
                <span className="nt-meta-sep" />
                <span className="nt-tnum">조회 {notice.viewCount}</span>
              </div>
            )}
          </div>

          {notice && (
            <NoticeHtmlView content={notice.content} contentFormat={notice.contentFormat} />
          )}

          {notice && <NoticeAttachmentList attachments={notice.attachments} />}

          <div className="nt-actions nt-actions-article">
            <Link className="fl-btn" to="/notices">
              목록
            </Link>
            {canEdit && (
              <div className="nt-actions-right">
                <button className="fl-btn fl-btn-danger" onClick={onDelete}>
                  삭제
                </button>
                <Link className="fl-btn fl-btn-primary" to={`/notice/${noticeId}/edit`}>
                  수정
                </Link>
              </div>
            )}
          </div>

          <div className="nt-comments">
            <div className="nt-comments-title">
              댓글 <span className="nt-comments-count">{comments.length}</span>
            </div>

            {isAuthenticated() && (
              <form className="nt-comment-form" onSubmit={onSubmit}>
                <textarea
                  className="fl-input nt-textarea"
                  placeholder="댓글을 남겨보세요..."
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, 500))}
                  rows={3}
                />
                {error && <p className="fl-error">{error}</p>}
                <div className="nt-comment-form-foot">
                  <span className="nt-charcount">{text.length}/500</span>
                  <button
                    className="fl-btn fl-btn-primary fl-btn-sm"
                    type="submit"
                    disabled={!text.trim() || submitting}
                  >
                    {submitting ? '등록 중...' : '댓글 등록'}
                  </button>
                </div>
              </form>
            )}

            {comments.length === 0 ? (
              <div className="fl-empty">첫 번째 댓글을 남겨보세요!</div>
            ) : (
              <div className="nt-comment-tree">
                {commentTree.map((root) => (
                  <CommentNode
                    key={root.id}
                    node={root}
                    noticeId={noticeId}
                    onReply={onReply}
                    onDelete={onCommentDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        {(neighbors.prev || neighbors.next) && (
          <section className="fl-card">
            <div className="fl-card-head">
              <span className="fl-card-title">이전 · 다음 글</span>
            </div>
            <div className="fl-card-body fl-flush">
              <NeighborRow label="이전" notice={neighbors.prev} />
              <NeighborRow label="다음" notice={neighbors.next} />
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function NeighborRow({
  label,
  notice,
}: {
  label: string
  notice: { id: number; title: string } | null
}) {
  const body = (
    <>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fl-muted-2)' }}>{label}</span>
      <span className="fl-linkrow-title">
        {notice ? notice.title : label === '이전' ? '첫 글입니다' : '최신 글입니다'}
      </span>
    </>
  )

  const style = { flexDirection: 'column' as const, alignItems: 'flex-start' as const, gap: 4 }

  if (!notice) {
    return (
      <div className="fl-linkrow" style={{ ...style, color: 'var(--fl-muted-2)' }}>
        {body}
      </div>
    )
  }

  return (
    <Link className="fl-linkrow" to={`/notice/${notice.id}`} style={style}>
      {body}
    </Link>
  )
}
