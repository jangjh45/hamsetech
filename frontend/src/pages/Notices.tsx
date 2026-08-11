import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
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
import '../styles/notices.css'

const PAGE_SIZE = 10

export default function NoticesPage() {
  const [items, setItems] = useState<NoticeSummary[]>([])
  const [pinned, setPinned] = useState<NoticeSummary[]>([])
  const [q, setQ] = useState('')
  const [category, setCategory] = useState<NoticeCategory | ''>('')
  const [page, setPage] = useState(0)
  const [totalElements, setTotalElements] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (p: number, query: string, cat: NoticeCategory | '') => {
    setLoading(true)
    try {
      const resp = await listNotices(p, PAGE_SIZE, query, cat || undefined)
      setItems(resp.page.content)
      setPinned(resp.pinned)
      setTotalElements(resp.page.totalElements)
      setTotalPages(resp.page.totalPages)
      setPage(resp.page.number)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(0, q, category)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function onSearch() {
    load(0, q, category)
  }

  function onCategoryChange(next: NoticeCategory | '') {
    setCategory(next)
    load(0, q, next)
  }

  function go(p: number) {
    if (p < 0 || p >= totalPages) return
    load(p, q, category)
  }

  // 고정 공지가 페이징 밖으로 빠져 있어 이 계산은 고정글 수와 무관하게 그대로 맞다
  const startNumber = totalElements - page * PAGE_SIZE

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>공지사항</h1>
          <p>전체 {totalElements}건</p>
        </div>
        {isAdmin() && (
          <Link className="fl-btn fl-btn-primary" to="/notice/new">
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
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            />
            <button className="fl-btn" onClick={onSearch} disabled={loading}>
              검색
            </button>
          </div>
        </div>

        <div className="fl-card-body fl-flush">
          <div className="nt-table-head">
            <div>번호</div>
            <div>분류</div>
            <div>제목</div>
            <div>작성자</div>
            <div style={{ textAlign: 'right' }}>조회</div>
            <div style={{ textAlign: 'right' }}>등록일</div>
          </div>

          {loading && <div className="fl-empty">불러오는 중...</div>}

          {!loading && pinned.map((n) => <NoticeRow key={`pin-${n.id}`} notice={n} />)}

          {!loading && items.length === 0 && pinned.length === 0 && (
            <div className="fl-empty">게시글이 없습니다.</div>
          )}

          {!loading &&
            items.map((n, idx) => <NoticeRow key={n.id} notice={n} number={startNumber - idx} />)}
        </div>

        <Pager page={page} totalPages={totalPages} onChange={go} disabled={loading} />
      </section>
    </div>
  )
}

/** 고정 공지는 번호 대신 '공지' 배지를 단다. */
function NoticeRow({ notice, number }: { notice: NoticeSummary; number?: number }) {
  const author = notice.authorDisplayName || notice.authorUsername

  return (
    <Link to={`/notice/${notice.id}`} className={`nt-row${notice.pinned ? ' is-pinned' : ''}`}>
      <span className="nt-row-num">
        {notice.pinned ? <span className="nt-badge-pin">공지</span> : number}
      </span>
      <span className="nt-row-cat">
        <span className="nt-badge-cat">{NOTICE_CATEGORY_LABELS[notice.category]}</span>
      </span>
      <span className="nt-row-title">
        {notice.title}
        {notice.commentCount > 0 && <span className="nt-row-badge">💬 {notice.commentCount}</span>}
        {notice.attachmentCount > 0 && <span className="nt-row-badge">📎 {notice.attachmentCount}</span>}
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
