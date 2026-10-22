import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  listNotices,
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_LABELS,
  type NoticeCategory,
  type NoticeSummary,
} from '../api/notices'
import { isAdmin } from '../auth/token'
import { formatDate } from '../utils/formatDate'
import Pager from '../components/Pager'
import { CommentIcon, PaperclipIcon } from '../components/NoticeIcons'
import '../styles/notices.css'

const PAGE_SIZE = 10

export default function NoticesPage() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''
  const categoryParam = searchParams.get('category') ?? ''
  const category: NoticeCategory | '' = NOTICE_CATEGORIES.includes(categoryParam as NoticeCategory)
    ? categoryParam as NoticeCategory
    : ''
  const pageParam = Number(searchParams.get('page') ?? '0')
  const page = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 0
  const [items, setItems] = useState<NoticeSummary[]>([])
  const [pinned, setPinned] = useState<NoticeSummary[]>([])
  const [pinnedTotal, setPinnedTotal] = useState(0)
  const [queryDraftState, setQueryDraftState] = useState({ query: q, value: q })
  const queryDraft = queryDraftState.query === q ? queryDraftState.value : q
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams(searchParams)
    let normalized = false
    if (params.has('page') && (!Number.isSafeInteger(pageParam) || pageParam <= 0)) {
      params.delete('page')
      normalized = true
    }
    if (categoryParam && !category) {
      params.delete('category')
      normalized = true
    }
    if (normalized) {
      setSearchParams(params, { replace: true })
    }
    // Loading state is synchronized with the URL-driven request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    setError('')
    listNotices(page, PAGE_SIZE, q, category || undefined)
      .then((resp) => {
        if (cancelled) return
        const lastPage = Math.max(resp.page.totalPages - 1, 0)
        if (page > lastPage) {
          const params = new URLSearchParams(searchParams)
          if (lastPage === 0) params.delete('page')
          else params.set('page', String(lastPage))
          setSearchParams(params, { replace: true })
          return
        }
        setItems(resp.page.content)
        setPinned(resp.pinned)
        setPinnedTotal(resp.pinnedTotal)
        setTotalElements(resp.page.totalElements)
        setTotalPages(resp.page.totalPages)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '공지사항을 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, pageParam, q, category, categoryParam, retryKey, searchParams, setSearchParams])

  function onSearch() {
    const params = new URLSearchParams(searchParams)
    const nextQuery = queryDraft.trim()
    if (nextQuery) params.set('q', nextQuery)
    else params.delete('q')
    params.delete('page')
    setSearchParams(params)
  }

  function onCategoryChange(next: NoticeCategory | '') {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('category', next)
    else params.delete('category')
    params.delete('page')
    setSearchParams(params)
  }

  function go(p: number) {
    if (p < 0 || p >= totalPages) return
    const params = new URLSearchParams(searchParams)
    if (p === 0) params.delete('page')
    else params.set('page', String(p))
    setSearchParams(params)
  }

  // 고정 공지가 페이징 밖으로 빠져 있어 이 계산은 고정글 수와 무관하게 그대로 맞다
  const startNumber = totalElements - page * PAGE_SIZE

  // 머리말 건수에는 고정 공지도 넣는다. totalElements는 일반글만 세기 때문에
  // 그대로 쓰면 화면에 보이는 줄 수보다 적게 나온다.
  const displayTotal = totalElements + pinnedTotal

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>공지사항</h1>
          <p>전체 {displayTotal}건</p>
        </div>
        {isAdmin() && (
          <Link className="fl-btn fl-btn-primary" to={`/notice/new${location.search}`}>
            공지 등록
          </Link>
        )}
      </div>

      <section className="fl-card">
        <div className="fl-card-head">
          <span className="fl-card-title">전체 목록</span>
          <div className="nt-search">
            <select
              className="fl-input nt-select"
              value={category}
              aria-label="공지사항 분류"
              onChange={(e) => onCategoryChange(e.target.value as NoticeCategory | '')}
            >
              <option value="">전체 분류</option>
              {NOTICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {NOTICE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              className="fl-input"
              placeholder="제목 · 내용 · 작성자 검색"
              aria-label="공지사항 검색어"
              value={queryDraft}
              onChange={(e) => setQueryDraftState({ query: q, value: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <button className="fl-btn" onClick={onSearch} disabled={loading}>
              검색
            </button>
          </div>
        </div>

        <div
          className="fl-card-body fl-flush"
          aria-busy={loading}
          style={{ opacity: loading ? 0.5 : 1, transition: 'opacity 0.15s' }}
        >
          <div className="nt-table-head">
            <div>번호</div>
            <div>분류</div>
            <div>제목</div>
            <div>작성자</div>
            <div style={{ textAlign: 'right' }}>조회</div>
            <div style={{ textAlign: 'right' }}>등록일</div>
          </div>

          {!loading && error && (
            <div className="fl-empty" role="alert">
              <p>{error}</p>
              <button className="fl-btn fl-btn-sm" onClick={() => setRetryKey((key) => key + 1)}>
                다시 시도
              </button>
            </div>
          )}

          {!error && pinned.map((n) => (
            <NoticeRow key={`pin-${n.id}`} notice={n} search={location.search} />
          ))}

          {!loading && !error && items.length === 0 && pinned.length === 0 && (
            <div className="fl-empty">게시글이 없습니다.</div>
          )}

          {!error && items.map((n, idx) => (
            <NoticeRow key={n.id} notice={n} number={startNumber - idx} search={location.search} />
          ))}
        </div>

        <Pager page={page} totalPages={totalPages} onChange={go} disabled={loading || !!error} />
      </section>
    </div>
  )
}

/** 고정 공지는 번호 대신 '공지' 배지를 단다. */
function NoticeRow({ notice, number, search }: { notice: NoticeSummary; number?: number; search: string }) {
  const author = notice.authorDisplayName || notice.authorUsername

  return (
    <Link to={`/notice/${notice.id}${search}`} className={`nt-row${notice.pinned ? ' is-pinned' : ''}`}>
      <span className="nt-row-num">
        {notice.pinned ? <span className="nt-badge-pin">공지</span> : number}
      </span>
      <span className="nt-row-cat">
        <span className="nt-badge-cat">{NOTICE_CATEGORY_LABELS[notice.category]}</span>
      </span>
      <span className="nt-row-title" title={notice.title}>
        {notice.title}
        {notice.commentCount > 0 && (
          <span className="nt-row-badge" title={`댓글 ${notice.commentCount}개`}>
            <CommentIcon />
            {notice.commentCount}
          </span>
        )}
        {notice.attachmentCount > 0 && (
          <span className="nt-row-badge" title={`첨부파일 ${notice.attachmentCount}개`}>
            <PaperclipIcon />
            {notice.attachmentCount}
          </span>
        )}
      </span>
      <span className="nt-row-author">{author}</span>
      <span className="nt-row-views">{notice.viewCount}</span>
      <span className="nt-row-date">{formatDate(notice.createdAt)}</span>
      {/* 모바일에서만 보이는 요약 줄 (번호·분류·작성자·조회·날짜) */}
      <span className="nt-row-meta">
        <span>{notice.pinned ? '공지' : `#${number}`}</span>
        <span>·</span>
        <span>{NOTICE_CATEGORY_LABELS[notice.category]}</span>
        <span>·</span>
        <span>{author}</span>
        <span>·</span>
        <span>조회 {notice.viewCount}</span>
        <span>·</span>
        <span>{formatDate(notice.createdAt)}</span>
      </span>
    </Link>
  )
}
