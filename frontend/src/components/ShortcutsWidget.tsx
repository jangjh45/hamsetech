import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getUsername, isAdmin } from '../auth/token'
import {
  loadShortcutSettings,
  moveShortcut,
  saveShortcutSettings,
  toggleShortcut,
  type ShortcutId,
  type ShortcutSettings,
} from '../utils/homeShortcuts'

interface ShortcutsWidgetProps {
  /** 이번 달 승인 대기 건수. 양수면 대기 목록으로 바로 연결한다. */
  pendingCount: number | null
}

interface ShortcutItem {
  id: ShortcutId
  to: string
  title: string
  sub: string
}

export default function ShortcutsWidget({ pendingCount }: ShortcutsWidgetProps) {
  const username = getUsername()
  const admin = isAdmin()
  const items: ShortcutItem[] = [
    { id: 'delivery', to: '/delivery', title: '적재 시뮬레이터', sub: '출하 적재 계산' },
    {
      id: 'overtime',
      to: pendingCount !== null && pendingCount > 0 ? '/overtime?status=PENDING' : '/overtime',
      title: '잔업 등록',
      sub: pendingCount === null
        ? '이번 달 대기 현황 확인 필요'
        : pendingCount > 0
          ? `이번 달 ${pendingCount}건 대기 · 바로 보기`
          : '이번 달 대기 없음 · 기록 등록',
    },
    { id: 'vendors', to: '/vendors', title: '업체 주소록', sub: '업체·담당자 연락처 찾기' },
    { id: 'notices', to: '/notices', title: '공지사항', sub: '사내 공지 확인' },
    { id: 'admin', to: '/admin', title: '관리자', sub: '사용자·승인·운영 관리' },
    { id: 'noticeCreate', to: '/notice/new', title: '공지 작성', sub: '부서 공지 등록' },
    { id: 'profile', to: '/profile', title: '내 정보', sub: '연락처 · 비밀번호' },
  ]
  const availableItems = items.filter(
    (item) => (item.id !== 'admin' && item.id !== 'noticeCreate') || admin,
  )
  const availableIds = availableItems.map((item) => item.id)

  const [settings, setSettings] = useState<ShortcutSettings>(
    () => loadShortcutSettings(username, availableIds),
  )
  const [editing, setEditing] = useState(false)

  function updateSettings(next: ShortcutSettings) {
    setSettings(next)
    saveShortcutSettings(next, username)
  }

  const itemById = new Map(items.map((item) => [item.id, item]))
  const orderedItems = settings.order
    .filter((id) => availableIds.includes(id))
    .map((id) => itemById.get(id))
    .filter((item): item is ShortcutItem => item !== undefined)
  const visibleItems = orderedItems.filter((item) => !settings.hidden.includes(item.id))

  return (
    <>
      <div className="fl-card-head">
        <span className="fl-card-title">바로가기</span>
        <button
          className="fl-link"
          onClick={() => setEditing((current) => !current)}
          aria-expanded={editing}
        >
          {editing ? '편집 완료' : '편집'}
        </button>
      </div>

      {editing && (
        <div className="fl-card-body" style={{ paddingBottom: 0 }}>
          <div style={{ fontSize: 13, color: 'var(--fl-muted)' }}>
            자주 쓰는 메뉴를 표시하고 순서를 바꾸세요.
          </div>
          <div className="fl-list" role="group" aria-label="바로가기 설정">
            {orderedItems.map((item) => {
              const hidden = settings.hidden.includes(item.id)
              const index = settings.order.indexOf(item.id)
              return (
                <div key={item.id} className={`fl-edit-row${hidden ? ' is-hidden' : ''}`}>
                  <label className={`fl-edit-label${hidden ? ' is-hidden' : ''}`}>
                    <input
                      type="checkbox"
                      className="fl-check"
                      checked={!hidden}
                      onChange={() => updateSettings(toggleShortcut(settings, item.id))}
                    />
                    <span>{item.title}</span>
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      className="fl-btn-icon fl-btn-sm"
                      onClick={() => updateSettings(moveShortcut(settings, item.id, 'up'))}
                      disabled={index <= 0}
                      aria-label={`${item.title} 위로 이동`}
                    >
                      ↑
                    </button>
                    <button
                      className="fl-btn-icon fl-btn-sm"
                      onClick={() => updateSettings(moveShortcut(settings, item.id, 'down'))}
                      disabled={index < 0 || index === settings.order.length - 1}
                      aria-label={`${item.title} 아래로 이동`}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="fl-card-body">
        {visibleItems.length === 0 ? (
          <div className="fl-empty">표시 중인 바로가기가 없습니다. 편집에서 메뉴를 선택하세요.</div>
        ) : (
          <div className="fl-tile-grid">
            {visibleItems.map((item) => (
              <Link key={item.id} to={item.to} className="fl-tile">
                <span className="fl-tile-title">{item.title}</span>
                <span className="fl-tile-sub">{item.sub}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
