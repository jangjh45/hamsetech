/*
 * 공지 화면에서 쓰는 선 아이콘.
 *
 * 이모지(📎 💬) 대신 쓴다. 이모지는 OS마다 모양과 색이 제각각이라 다크 모드에서
 * 혼자 튀고, 이 앱이 UI 기호에 쓰는 단색 글리프(✎ ✕ ✓)와도 결이 다르다.
 * 전부 currentColor라 감싼 요소의 글자색을 그대로 따라간다.
 *
 * 크기는 CSS로 정한다(.nt-attach-icon, .nt-row-badge svg). 여기서 width/height를
 * 박아 두면 목록의 작은 배지와 첨부 행에서 같은 크기로 나와 한쪽이 어색해진다.
 */

interface IconProps {
  className?: string
}

/** 첨부파일. */
export function PaperclipIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

/** 댓글. */
export function CommentIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
