import { Link } from 'react-router-dom'
import { isAdmin, isAuthenticated } from '../auth/token'

interface ShortcutsWidgetProps {
  /** 이번 달 승인 대기 건수 (잔업 등록 타일 부제) */
  pendingCount: number
}

export default function ShortcutsWidget({ pendingCount }: ShortcutsWidgetProps) {
  const authed = isAuthenticated()
  const admin = isAdmin()

  // 라우트 가드에 튕길 링크는 애초에 노출하지 않는다 (Header와 같은 기준)
  const tiles = [
    { to: '/delivery', title: '적재 시뮬레이터', sub: '출하 적재 계산', show: true },
    {
      to: '/overtime',
      title: '잔업 등록',
      sub: pendingCount > 0 ? `이번 달 ${pendingCount}건 대기` : '이번 달 대기 없음',
      show: authed,
    },
    { to: '/notice/new', title: '공지 작성', sub: '부서 공지 등록', show: admin },
    { to: '/profile', title: '내 정보', sub: '연락처 · 비밀번호', show: authed },
  ].filter((tile) => tile.show)

  return (
    <>
      <div className="fl-card-head">
        <span className="fl-card-title">바로가기</span>
      </div>

      <div className="fl-card-body">
        {tiles.length === 0 ? (
          <div className="fl-empty">로그인하면 자주 쓰는 메뉴가 여기에 표시됩니다.</div>
        ) : (
          <div className="fl-tile-grid">
            {tiles.map((tile) => (
              <Link key={tile.to} to={tile.to} className="fl-tile">
                <span className="fl-tile-title">{tile.title}</span>
                <span className="fl-tile-sub">{tile.sub}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
