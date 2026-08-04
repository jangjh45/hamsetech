import { useState, useEffect, type ReactNode } from 'react'
import Clock from '../components/Clock'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'
import RecentNotices from '../components/RecentNotices'
import OvertimeSummary from '../components/OvertimeSummary'
import TodayScheduleWidget from '../components/TodayScheduleWidget'
import ShortcutsWidget from '../components/ShortcutsWidget'
import HomeEditPanel from '../components/HomeEditPanel'
import useDashboardData from '../hooks/useDashboardData'
import { toYmd } from '../utils/formatDate'
import {
  loadLayout,
  saveLayout,
  visibleOrder,
  WIDGET_SIZES,
  type WidgetId,
  type HomeLayout,
} from '../utils/homeLayout'

export default function HomePage() {
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<string>(toYmd(new Date()))
  const [layout, setLayout] = useState<HomeLayout>(() => loadLayout())
  const [editing, setEditing] = useState<boolean>(false)

  const { todayEvents, todayTodos, monthOvertime, refresh } = useDashboardData()

  // 레이아웃 변경 시 localStorage에 저장
  useEffect(() => {
    saveLayout(layout)
  }, [layout])

  // 월의 시작과 끝 날짜 계산
  const monthStart = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1))
  const monthEnd = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0))

  const visible = visibleOrder(layout)
  const pendingCount = monthOvertime.filter((r) => r.status === 'PENDING').length
  const remainingTodoCount = todayTodos.filter((t) => !t.completed).length

  // "오늘 일정" 위젯 → 캘린더 위젯으로 이동. 캘린더가 숨겨져 있으면 링크를 감춘다.
  const showCalendar = visible.includes('calendar')
  function goToCalendar() {
    const today = new Date()
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelected(toYmd(today))
    document.getElementById('widget-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 위젯 레지스트리: id → 렌더 함수 (Home의 상태를 클로저로 참조)
  const registry: Record<WidgetId, () => ReactNode> = {
    clock: () => <Clock />,
    today: () => (
      <TodayScheduleWidget events={todayEvents} onShowAll={showCalendar ? goToCalendar : undefined} />
    ),
    overtime: () => <OvertimeSummary records={monthOvertime} />,
    calendar: () => (
      <CalendarWidget
        viewDate={viewDate}
        setViewDate={setViewDate}
        selected={selected}
        setSelected={setSelected}
        onEventsChanged={refresh}
      />
    ),
    todo: () => (
      <TodoList
        selectedDate={selected}
        monthStart={monthStart}
        monthEnd={monthEnd}
        onTodosChanged={refresh}
      />
    ),
    notices: () => <RecentNotices />,
    shortcuts: () => <ShortcutsWidget pendingCount={pendingCount} />,
  }

  const summaryParts = [
    `오늘 일정 ${todayEvents.length}건`,
    `남은 할 일 ${remainingTodoCount}건`,
    `승인 대기 ${pendingCount}건`,
  ]

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>오늘 업무 현황</h1>
          <p>{summaryParts.join(' · ')}</p>
        </div>
        <button className="fl-btn" onClick={() => setEditing((v) => !v)}>
          {editing ? '편집 닫기' : '위젯 편집'}
        </button>
      </div>

      {editing && (
        <HomeEditPanel layout={layout} onChange={setLayout} onClose={() => setEditing(false)} />
      )}

      {visible.length === 0 ? (
        <div className="fl-card">
          <div className="fl-empty" style={{ padding: '48px 24px' }}>
            모든 위젯이 숨겨졌습니다. 편집에서 다시 켜주세요.
          </div>
        </div>
      ) : (
        <div className="fl-grid">
          {visible.map((id) => (
            <section key={id} id={`widget-${id}`} className={`fl-card fl-w-${WIDGET_SIZES[id]}`}>
              {registry[id]()}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
