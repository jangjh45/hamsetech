import { useState, useEffect, type ReactNode } from 'react'
import Clock from '../components/Clock'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'
import RecentNotices from '../components/RecentNotices'
import OvertimeSummary from '../components/OvertimeSummary'
import HomeEditPanel from '../components/HomeEditPanel'
import { loadLayout, saveLayout, visibleOrder, type WidgetId, type HomeLayout } from '../utils/homeLayout'

function toYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function HomePage() {
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<string>(toYmd(new Date()))
  const [layout, setLayout] = useState<HomeLayout>(() => loadLayout())
  const [editing, setEditing] = useState<boolean>(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 레이아웃 변경 시 localStorage에 저장
  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  // 월의 시작과 끝 날짜 계산
  const monthStart = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1))
  const monthEnd = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0))

  // 위젯 레지스트리: id → 렌더 함수 (Home의 상태를 클로저로 참조)
  const registry: Record<WidgetId, () => ReactNode> = {
    clock: () => <Clock />,
    calendar: () => (
      <CalendarWidget
        viewDate={viewDate}
        setViewDate={setViewDate}
        selected={selected}
        setSelected={setSelected}
      />
    ),
    notices: () => <RecentNotices />,
    overtime: () => <OvertimeSummary />,
    todo: () => <TodoList selectedDate={selected} monthStart={monthStart} monthEnd={monthEnd} />,
  }

  const visible = visibleOrder(layout)
  // 정렬된 위젯을 두 열로 분배: 앞쪽 절반 → 왼쪽, 나머지 → 오른쪽
  const mid = Math.ceil(visible.length / 2)
  const leftCol = isMobile ? visible : visible.slice(0, mid)
  const rightCol = isMobile ? [] : visible.slice(mid)

  const renderCard = (id: WidgetId) => (
    <div key={id} className="card" style={{ padding: isMobile ? 12 : 16 }}>
      {registry[id]()}
    </div>
  )

  return (
    <div className="container" style={{
      display: 'flex',
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{
        maxWidth: isMobile ? '100%' : 1400,
        width: '100%',
        margin: '0 auto'
      }}>
        {/* 편집 툴바 */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: isMobile ? 8 : 16
        }}>
          <button
            className="btn ghost"
            onClick={() => setEditing((v) => !v)}
            style={{ padding: '6px 14px', fontSize: isMobile ? 13 : 14 }}
          >
            {editing ? '✕ 편집 닫기' : '⚙️ 편집'}
          </button>
        </div>

        {editing && (
          <HomeEditPanel
            layout={layout}
            onChange={setLayout}
            onClose={() => setEditing(false)}
            isMobile={isMobile}
          />
        )}

        {visible.length === 0 ? (
          <div className="card" style={{
            textAlign: 'center',
            padding: isMobile ? '32px 16px' : '48px 32px',
            marginTop: isMobile ? 8 : 16,
            opacity: 0.7,
            fontSize: isMobile ? 14 : 16
          }}>
            모든 위젯이 숨겨졌습니다. 편집에서 다시 켜주세요.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? 16 : 24,
            marginTop: isMobile ? 8 : 16,
            alignItems: 'start'
          }}>
            {/* 왼쪽 열 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: isMobile ? 16 : 20,
              width: '100%'
            }}>
              {leftCol.map(renderCard)}
            </div>

            {/* 오른쪽 열 (데스크톱만) */}
            {!isMobile && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                width: '100%'
              }}>
                {rightCol.map(renderCard)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
