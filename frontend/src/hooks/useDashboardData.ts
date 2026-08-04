import { useCallback, useEffect, useState } from 'react'
import { listEvents, type CalendarEvent } from '../api/calendar'
import { getTodosByDate, type Todo } from '../api/todos'
import { listMyOvertimeRecords, type OvertimeRecord } from '../api/overtimeRecords'
import { toYmd } from '../utils/formatDate'

export interface DashboardData {
  todayEvents: CalendarEvent[]
  todayTodos: Todo[]
  monthOvertime: OvertimeRecord[]
  /** 위젯에서 일정/할 일을 추가·삭제한 뒤 타이틀 밴드 건수를 갱신할 때 호출 */
  refresh: () => void
}

// 타이틀 밴드 요약, 오늘 일정, 잔업/특근 요약, 바로가기 배지가 모두 같은 데이터를
// 필요로 한다. 네 곳에서 각각 API를 호출하지 않도록 Home에서 한 번만 불러
// props로 내려준다.
//
// 홈은 ProtectedRoute 안에 있어 로그인 상태에서만 렌더된다. 비로그인 분기는 없다.
export default function useDashboardData(): DashboardData {
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [todayTodos, setTodayTodos] = useState<Todo[]>([])
  const [monthOvertime, setMonthOvertime] = useState<OvertimeRecord[]>([])
  const [tick, setTick] = useState(0)

  const refresh = useCallback(() => setTick((n) => n + 1), [])

  useEffect(() => {
    const now = new Date()
    const today = toYmd(now)
    const from = toYmd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    listEvents(today, today)
      .then(setTodayEvents)
      .catch(() => {})
    getTodosByDate(today)
      .then(setTodayTodos)
      .catch(() => {})
    listMyOvertimeRecords(from, to)
      .then(setMonthOvertime)
      .catch(() => {})
  }, [tick])

  return { todayEvents, todayTodos, monthOvertime, refresh }
}
