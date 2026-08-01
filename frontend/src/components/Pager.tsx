const PAGER_WINDOW = 5

// 현재 페이지를 가운데 두되 양 끝에서는 밀어서 항상 최대 5개를 보여준다.
export function pageWindow(page: number, totalPages: number): number[] {
  const size = Math.min(PAGER_WINDOW, totalPages)
  let start = page - Math.floor(size / 2)
  start = Math.max(0, Math.min(start, totalPages - size))
  return Array.from({ length: size }, (_, i) => start + i)
}

interface PagerProps {
  /** 0-based */
  page: number
  totalPages: number
  onChange: (page: number) => void
  /** 로딩 중에는 연타를 막는다 */
  disabled?: boolean
}

/**
 * 공지사항·잔업특근·관리자가 공유하는 숫자 페이저.
 * 카드(.fl-card) 맨 아래에 두면 위쪽 구분선이 카드 바닥과 맞는다.
 */
export default function Pager({ page, totalPages, onChange, disabled }: PagerProps) {
  if (totalPages <= 1) return null

  function go(p: number) {
    if (disabled || p < 0 || p >= totalPages || p === page) return
    onChange(p)
  }

  return (
    <div className="fl-pager">
      <button
        className="fl-page-btn fl-page-arrow"
        onClick={() => go(page - 1)}
        disabled={disabled || page <= 0}
        aria-label="이전 페이지"
      >
        ◀
      </button>
      {pageWindow(page, totalPages).map((p) => (
        <button
          key={p}
          className={p === page ? 'fl-page-btn is-active' : 'fl-page-btn'}
          onClick={() => go(p)}
          disabled={disabled}
          aria-current={p === page ? 'page' : undefined}
        >
          {p + 1}
        </button>
      ))}
      <button
        className="fl-page-btn fl-page-arrow"
        onClick={() => go(page + 1)}
        disabled={disabled || page >= totalPages - 1}
        aria-label="다음 페이지"
      >
        ▶
      </button>
    </div>
  )
}
