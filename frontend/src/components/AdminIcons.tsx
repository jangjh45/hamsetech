/*
 * 관리자 화면 사용자 목록의 행 동작 아이콘.
 *
 * NoticeIcons와 같은 규칙을 따른다 — 이모지 대신 선 아이콘, 색은 전부
 * currentColor라 감싼 버튼의 글자색을 그대로 따라간다. 크기는 CSS(.ad-row-action svg)가
 * 정한다.
 *
 * 아이콘만으로는 무슨 동작인지 알기 어려우므로, 쓰는 쪽에서 title과 aria-label을
 * 반드시 함께 준다.
 */

interface IconProps {
  className?: string
}

/** 비밀번호 초기화. 열쇠. */
export function KeyIcon({ className }: IconProps) {
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
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2" />
      <path d="M17 6l3 3" />
    </svg>
  )
}

/** 탈퇴 처리. 사람에서 빼기. */
export function UserMinusIcon({ className }: IconProps) {
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
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 11h6" />
    </svg>
  )
}
