import { useState, useEffect, useRef, type ReactNode } from 'react'
import Clock from '../components/Clock'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'
import RecentNotices from '../components/RecentNotices'
import OvertimeSummary from '../components/OvertimeSummary'
import TodayScheduleWidget from '../components/TodayScheduleWidget'
import ShortcutsWidget from '../components/ShortcutsWidget'
import HomeEditPanel from '../components/HomeEditPanel'
import HomeMonthDataProvider from '../components/HomeMonthDataProvider'
import useDashboardData from '../hooks/useDashboardData'
import { useHomeMonthData } from '../hooks/useHomeMonthData'
import { getUsername } from '../auth/token'
import { toYmd } from '../utils/formatDate'
import {
  canImportLegacyLayout,
  importLegacyLayout,
  loadLayout,
  saveLayout,
  visibleOrder,
  WIDGET_SIZES,
  type WidgetId,
  type HomeLayout,
} from '../utils/homeLayout'

export default function HomePage() {
  return (
    <HomeMonthDataProvider>
      <HomeDashboard />
    </HomeMonthDataProvider>
  )
}

function HomeDashboard() {
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<string>(toYmd(new Date()))
  const [widgetRevision, setWidgetRevision] = useState(0)
  const username = getUsername()
  const [layout, setLayout] = useState<HomeLayout>(() => loadLayout(username))
  const [layoutTouched, setLayoutTouched] = useState(false)
  const [canImportLegacy, setCanImportLegacy] = useState(() => canImportLegacyLayout(username))
  const [editing, setEditing] = useState<boolean>(false)

  const {
    todayDate,
    monthOvertime,
    overdueTodos,
    loading: dashboardLoading,
    errors: dashboardErrors,
    refreshVersion,
    refreshSummary,
    refresh,
  } = useDashboardData()

  const [todayYear, todayMonth] = todayDate.split('-').map(Number)
  const todayMonthStart = toYmd(new Date(todayYear, todayMonth - 1, 1))
  const todayMonthEnd = toYmd(new Date(todayYear, todayMonth, 0))
  const todayMonthData = useHomeMonthData(todayMonthStart, todayMonthEnd, refreshVersion)

  const previousToday = useRef(todayDate)

  // 날짜가 바뀌었을 때 오늘을 보고 있었으면 새 날짜로 따라간다.
  useEffect(() => {
    const previousDate = previousToday.current
    if (todayDate === previousDate) return

    if (selected === previousDate) {
      const [year, month] = todayDate.split('-').map(Number)
      setViewDate(new Date(year, month - 1, 1))
      setSelected(todayDate)
      setWidgetRevision((revision) => revision + 1)
    }
    previousToday.current = todayDate
  }, [todayDate, selected])

  // 레이아웃 변경만 저장한다. 기본 배치를 자동 저장하지 않아 기존 공용 설정을 선택적으로 가져올 수 있다.
  useEffect(() => {
    if (layoutTouched) saveLayout(layout, username)
  }, [layout, layoutTouched, username])

  // 월의 시작과 끝 날짜 계산
  const monthStart = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1))
  const monthEnd = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0))
  const monthData = useHomeMonthData(monthStart, monthEnd, refreshVersion)

  const todayEvents = todayMonthData.events === null
    ? null
    : todayMonthData.events.filter((event) => event.date === todayDate)
  const todayTodos = todayMonthData.todos === null
    ? null
    : todayMonthData.todos.filter((todo) => todo.date === todayDate)
  const summaryLoading = dashboardLoading || todayMonthData.eventsLoading || todayMonthData.todosLoading

  const visible = visibleOrder(layout)
  const pendingCount = monthOvertime?.filter((r) => r.status === 'PENDING').length ?? null
  const remainingTodoCount = todayTodos?.filter((t) => !t.completed).length ?? null

  function changeLayout(next: HomeLayout) {
    setLayout(next)
    setLayoutTouched(true)
  }

  function changeSelectedDate(date: string) {
    if (date === selected) return
    setSelected(date)
    setWidgetRevision((revision) => revision + 1)
  }

  function changeViewDate(date: Date) {
    if (date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth()) return
    setViewDate(date)
    setWidgetRevision((revision) => revision + 1)
  }

  function handleImportLegacyLayout() {
    const imported = importLegacyLayout(username)
    if (!imported) return
    setLayout(imported)
    setLayoutTouched(false)
    setCanImportLegacy(false)
  }

  // "오늘 일정" 위젯 → 캘린더 위젯으로 이동. 캘린더가 숨겨져 있으면 링크를 감춘다.
  const showCalendar = visible.includes('calendar')
  function goToCalendar() {
    const today = new Date()
    changeViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
    changeSelectedDate(toYmd(today))
    document.getElementById('widget-calendar')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function goToOverdueTodos() {
    const overdueDate = overdueTodos?.earliestDate
    if (!overdueDate) return
    const [year, month] = overdueDate.split('-').map(Number)
    changeViewDate(new Date(year, month - 1, 1))
    changeSelectedDate(overdueDate)
    document.getElementById('widget-todo')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 위젯 레지스트리: id → 렌더 함수 (Home의 상태를 클로저로 참조)
  const registry: Record<WidgetId, () => ReactNode> = {
    clock: () => <Clock />,
    today: () => (
      <TodayScheduleWidget
        events={todayEvents}
        loading={todayMonthData.eventsLoading && todayEvents === null}
        error={todayMonthData.eventsError}
        onShowAll={showCalendar ? goToCalendar : undefined}
      />
    ),
    overtime: () => (
      <OvertimeSummary
        records={monthOvertime}
        loading={dashboardLoading && monthOvertime === null}
        error={dashboardErrors.overtime}
      />
    ),
    calendar: () => (
      <CalendarWidget
        viewDate={viewDate}
        setViewDate={changeViewDate}
        selected={selected}
        setSelected={changeSelectedDate}
        resetVersion={widgetRevision}
        events={monthData.events}
        eventsLoading={monthData.eventsLoading}
        eventsError={monthData.eventsError}
        onRetry={monthData.retry}
        onEventsChange={monthData.updateEvents}
        onEventsChanged={refreshSummary}
      />
    ),
    todo: () => (
      <TodoList
        selectedDate={selected}
        resetVersion={widgetRevision}
        todos={monthData.todos}
        todosLoading={monthData.todosLoading}
        todosError={monthData.todosError}
        onRetry={monthData.retry}
        onTodosChange={monthData.updateTodos}
        onTodosChanged={refreshSummary}
      />
    ),
    notices: () => <RecentNotices />,
    shortcuts: () => <ShortcutsWidget pendingCount={pendingCount} />,
  }

  const summaryParts = [
    `오늘 일정 ${todayEvents?.length ?? '—'}건`,
    `남은 할 일 ${remainingTodoCount ?? '—'}건`,
    `밀린 할 일 ${overdueTodos?.count ?? '—'}건`,
    `승인 대기 ${pendingCount ?? '—'}건`,
  ]

  const loadErrorLabels = [
    todayMonthData.eventsError && '오늘 일정',
    todayMonthData.todosError && '오늘 할 일',
    dashboardErrors.overdueTodos && '밀린 할 일',
    dashboardErrors.overtime && '잔업·특근',
  ].filter(Boolean)

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>오늘 업무 현황</h1>
          <p>{summaryParts.join(' · ')}</p>
          {overdueTodos && overdueTodos.count > 0 && visible.includes('todo') && (
            <button className="fl-link" onClick={goToOverdueTodos}>
              가장 오래된 밀린 할 일 확인 →
            </button>
          )}
        </div>
        <button className="fl-btn" onClick={() => setEditing((v) => !v)}>
          {editing ? '편집 닫기' : '위젯 편집'}
        </button>
      </div>

      {summaryLoading && (
        <div className="fl-empty" role="status" aria-live="polite" style={{ padding: '8px 0 16px' }}>
          홈 정보를 불러오는 중...
        </div>
      )}

      {loadErrorLabels.length > 0 && (
        <div
          className="fl-error"
          role="alert"
          style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}
        >
          <span>일부 홈 정보를 불러오지 못했습니다: {loadErrorLabels.join(', ')}.</span>
          <button className="fl-btn fl-btn-sm" onClick={refresh} disabled={summaryLoading}>
            다시 시도
          </button>
        </div>
      )}

      {editing && (
        <HomeEditPanel
          layout={layout}
          onChange={changeLayout}
          onClose={() => setEditing(false)}
          canImportLegacy={canImportLegacy}
          onImportLegacy={handleImportLegacyLayout}
        />
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
