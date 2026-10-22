import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  addComment,
  getNotice,
  getNoticeNeighbors,
  listComments,
  deleteNotice,
  deleteComment,
  updateComment,
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_LABELS,
  type NoticeCategory,
  type NoticeDetail,
  type NoticeNeighbors,
  type NoticeComment,
} from '../api/notices'
import { ApiError } from '../api/client'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'
import { formatDateTime } from '../utils/formatDate'
import CommentNode, { type CommentNodeData } from '../components/CommentNode'
import { useConfirm } from '../components/ConfirmDialog'
import UserAvatar from '../components/UserAvatar'
import NoticeHtmlView from '../components/NoticeHtmlView'
import NoticeAttachmentList from '../components/NoticeAttachmentList'
import Pager from '../components/Pager'
import '../styles/notices.css'

function buildCommentTree(flatComments: NoticeComment[]): CommentNodeData[] {
  const map = new Map<number, CommentNodeData>()
  const roots: CommentNodeData[] = []

  flatComments.forEach((c) => map.set(c.id, { ...c, replies: [] }))

  flatComments.forEach((c) => {
    const node = map.get(c.id)!
    if (c.parentId != null && map.has(c.parentId)) {
      map.get(c.parentId)!.replies.push(node)
    } else {
      roots.push(node)
    }
  })

  const sortRepliesByTime = (nodes: CommentNodeData[]) => {
    nodes.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    nodes.forEach((n) => sortRepliesByTime(n.replies))
  }
  sortRepliesByTime(roots)
  roots.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return roots
}

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const location = useLocation()
  const listParams = new URLSearchParams(location.search)
  const neighborQuery = listParams.get('q') ?? ''
  const categoryParam = listParams.get('category') ?? ''
  const neighborCategory = NOTICE_CATEGORIES.includes(categoryParam as NoticeCategory)
    ? categoryParam as NoticeCategory
    : undefined
  const navigate = useNavigate()

  const [notice, setNotice] = useState<NoticeDetail | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [noticeLoading, setNoticeLoading] = useState(true)
  const [noticeError, setNoticeError] = useState('')
  const [noticeRetry, setNoticeRetry] = useState(0)
  const [comments, setComments] = useState<NoticeComment[]>([])
  const [neighbors, setNeighbors] = useState<NoticeNeighbors>({ prev: null, next: null })
  const [commentsPage, setCommentsPage] = useState(0)
  const [commentsTotalPages, setCommentsTotalPages] = useState(0)
  const [commentsTotalCount, setCommentsTotalCount] = useState(0)
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentsError, setCommentsError] = useState('')
  const commentsRequestId = useRef(0)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { confirm } = useConfirm()

  useEffect(() => {
    if (!Number.isSafeInteger(noticeId) || noticeId <= 0) return
    let cancelled = false
    // Loading state is synchronized with the route-driven request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNoticeLoading(true)
    setNoticeError('')
    setNotFound(false)
    getNotice(noticeId)
      .then((result) => {
        if (!cancelled) setNotice(result)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) setNotFound(true)
        else setNoticeError(err instanceof Error ? err.message : '공지사항을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setNoticeLoading(false)
      })
    return () => { cancelled = true }
  }, [noticeId, noticeRetry])

  const loadComments = useCallback(async (page: number) => {
    const requestId = ++commentsRequestId.current
    setCommentsLoading(true)
    setCommentsError('')
    try {
      const result = await listComments(noticeId, page)
      if (requestId !== commentsRequestId.current) return
      setComments(result.content)
      setCommentsPage(result.number)
      setCommentsTotalPages(result.totalPages)
      setCommentsTotalCount(result.totalComments)
    } catch (err: unknown) {
      if (requestId === commentsRequestId.current) {
        setCommentsError(err instanceof Error ? err.message : '댓글을 불러오지 못했습니다.')
      }
    } finally {
      if (requestId === commentsRequestId.current) setCommentsLoading(false)
    }
  }, [noticeId])

  useEffect(() => {
    if (!Number.isSafeInteger(noticeId) || noticeId <= 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadComments(0)
    return () => { commentsRequestId.current += 1 }
  }, [noticeId, loadComments])

  // 이전·다음 글은 부가 정보라 실패해도 조용히 넘긴다.
  useEffect(() => {
    if (!noticeId) return
    let cancelled = false
    getNoticeNeighbors(noticeId, neighborQuery, neighborCategory)
      .then((n) => {
        if (!cancelled) setNeighbors(n)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [noticeId, neighborQuery, neighborCategory])

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
      await loadComments(0)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  async function onReply(nid: number, parentId: number, content: string) {
    await addComment(nid, { content, parentId })
    await loadComments(commentsPage)
  }

  async function onCommentEdit(commentId: number, content: string) {
    const updated = await updateComment(noticeId, commentId, content)
    setComments((prev) => prev.map((comment) => comment.id === commentId ? updated : comment))
  }

  async function onCommentDelete(commentId: number) {
    const ok = await confirm({
      title: '댓글 삭제',
      message: '이 댓글을 삭제하시겠습니까? 삭제된 댓글은 되돌릴 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteComment(noticeId, commentId)
      await loadComments(commentsPage)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  async function onDelete() {
    if (!noticeId) return
    const ok = await confirm({
      title: '공지사항 삭제',
      message: '이 공지사항을 삭제하시겠습니까? 삭제된 공지사항은 되돌릴 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await deleteNotice(noticeId)
      navigate(`/notices${location.search}`)
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '삭제 실패')
    }
  }

  if (!Number.isSafeInteger(noticeId) || noticeId <= 0 || notFound) {
    return (
      <div className="fl-page">
        <section className="fl-card">
          <div className="fl-card-body">
            <div className="fl-empty">존재하지 않는 게시글입니다.</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Link className="fl-btn" to={`/notices${location.search}`}>
                목록으로
              </Link>
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (noticeLoading) {
    return <div className="fl-page" aria-busy="true" />
  }

  if (noticeError) {
    return (
      <div className="fl-page">
        <section className="fl-card">
          <div className="fl-card-body">
            <div className="fl-empty" role="alert">{noticeError}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              <button className="fl-btn fl-btn-primary" onClick={() => setNoticeRetry((retry) => retry + 1)}>
                다시 시도
              </button>
              <Link className="fl-btn" to={`/notices${location.search}`}>목록으로</Link>
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
        <Link to={`/notices${location.search}`}>공지사항</Link>
        <span className="nt-crumb-sep">/</span>
        <span>상세</span>
      </div>

      <div className="nt-detail-grid">
        <section className="fl-card">
          <div className="nt-article-head">
            <h1 className="nt-article-title">{notice?.title}</h1>
            {notice && (
              <div className="nt-article-meta">
                <span className="nt-badge-cat">{NOTICE_CATEGORY_LABELS[notice.category]}</span>
                {notice.pinned && <span className="nt-badge-pin">공지</span>}
                <span className="nt-meta-sep" />
                <span className="nt-article-meta-author">
                  <UserAvatar
                    className="nt-article-avatar"
                    src={notice.authorAvatarUrl}
                    label={`${author} 프로필 사진`}
                    size="sm"
                  />
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
            <Link className="fl-btn" to={`/notices${location.search}`}>
              목록
            </Link>
            {canEdit && (
              <div className="nt-actions-right">
                <button className="fl-btn fl-btn-danger" onClick={onDelete}>
                  삭제
                </button>
                <Link className="fl-btn fl-btn-primary" to={`/notice/${noticeId}/edit${location.search}`}>
                  수정
                </Link>
              </div>
            )}
          </div>

          <div className="nt-comments">
            <div className="nt-comments-title">
              댓글 <span className="nt-comments-count">{commentsTotalCount}</span>
            </div>

            {isAuthenticated() && (
              <form className="nt-comment-form" onSubmit={onSubmit}>
                <textarea
                  className="fl-input nt-textarea"
                  aria-label="댓글 입력"
                  placeholder="댓글을 남겨보세요..."
                  value={text}
                  maxLength={500}
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

            {!isAuthenticated() && (
              <div className="fl-empty">
                댓글을 작성하려면 <Link to="/login" state={{ from: location }}>로그인</Link>해주세요.
              </div>
            )}

            {!commentsLoading && commentsError && (
              <div className="fl-empty" role="alert">
                <p>{commentsError}</p>
                <button className="fl-btn fl-btn-sm" onClick={() => void loadComments(commentsPage)}>
                  다시 시도
                </button>
              </div>
            )}

            {!commentsLoading && !commentsError && commentsTotalCount === 0 ? (
              <div className="fl-empty">첫 번째 댓글을 남겨보세요!</div>
            ) : !commentsLoading && !commentsError && (
              <div className="nt-comment-tree">
                {commentTree.map((root) => (
                  <CommentNode
                    key={root.id}
                    node={root}
                    noticeId={noticeId}
                    onReply={onReply}
                    onEdit={onCommentEdit}
                    onDelete={onCommentDelete}
                  />
                ))}
              </div>
            )}
            {!commentsLoading && !commentsError && (
              <Pager
                page={commentsPage}
                totalPages={commentsTotalPages}
                onChange={(page) => void loadComments(page)}
              />
            )}
          </div>
        </section>

        {(neighbors.prev || neighbors.next) && (
          <section className="fl-card">
            <div className="fl-card-head">
              <span className="fl-card-title">이전 · 다음 글</span>
            </div>
            <div className="fl-card-body fl-flush">
              <NeighborRow label="이전" notice={neighbors.prev} search={location.search} />
              <NeighborRow label="다음" notice={neighbors.next} search={location.search} />
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
  search,
}: {
  label: string
  notice: { id: number; title: string } | null
  search: string
}) {
  const body = (
    <>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fl-muted-2)' }}>{label}</span>
      <span className="fl-linkrow-title nt-neighbor-title" title={notice?.title}>
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
    <Link className="fl-linkrow" to={`/notice/${notice.id}${search}`} style={style}>
      {body}
    </Link>
  )
}
