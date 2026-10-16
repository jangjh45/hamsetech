import { useCallback, useEffect, useRef, useState } from 'react'
import { getOverdueTodoSummary, type TodoOverdueSummary } from '../api/todos'
import { listMyOvertimeRecords, type OvertimeRecord } from '../api/overtimeRecords'
import { toYmd } from '../utils/formatDate'

type LoadErrors = {
  overtime: string
  overdueTodos: string
}

export interface DashboardData {
  todayDate: string
  monthOvertime: OvertimeRecord[] | null
  overdueTodos: TodoOverdueSummary | null
  loading: boolean
  errors: LoadErrors
  refreshVersion: number
  /** 홈 위젯에서 데이터를 바꾼 뒤 요약 건수를 갱신할 때 호출 */
  refreshSummary: () => void
  /** 전체 홈 데이터를 강제로 다시 불러온다. */
  refresh: () => void
}

type RequestResult<T> = { ok: true; data: T } | { ok: false; error: string }

const EMPTY_ERRORS: LoadErrors = { overtime: '', overdueTodos: '' }

async function settle<T>(request: Promise<T>): Promise<RequestResult<T>> {
  try {
    return { ok: true, data: await request }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error && error.message ? error.message : '요청을 완료하지 못했습니다.',
    }
  }
}

// 잔업/특근과 밀린 할 일 요약을 불러온다. 일정과 월별 할 일 데이터는
// HomeMonthDataProvider가 공유하며, 오늘 수치도 같은 응답에서 계산한다.
export default function useDashboardData(): DashboardData {
  const [todayDate, setTodayDate] = useState(() => toYmd(new Date()))
  const [monthOvertime, setMonthOvertime] = useState<OvertimeRecord[] | null>(null)
  const [overdueTodos, setOverdueTodos] = useState<TodoOverdueSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [errors, setErrors] = useState<LoadErrors>(EMPTY_ERRORS)
  const [tick, setTick] = useState(0)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const requestRef = useRef<{
    tick: number
    promise: Promise<[RequestResult<OvertimeRecord[]>, RequestResult<TodoOverdueSummary>]>
  } | null>(null)

  const refreshSummary = useCallback(() => {
    setLoading(true)
    setErrors(EMPTY_ERRORS)
    setTick((n) => n + 1)
  }, [])

  const refresh = useCallback(() => {
    setTodayDate(toYmd(new Date()))
    setRefreshVersion((n) => n + 1)
    refreshSummary()
  }, [refreshSummary])

  useEffect(() => {
    let active = true
    const now = new Date()
    const today = toYmd(now)
    const from = toYmd(new Date(now.getFullYear(), now.getMonth(), 1))
    const to = toYmd(new Date(now.getFullYear(), now.getMonth() + 1, 0))

    if (!requestRef.current || requestRef.current.tick !== tick) {
      requestRef.current = {
        tick,
        promise: Promise.all([
          settle(listMyOvertimeRecords(from, to)),
          settle(getOverdueTodoSummary(today)),
        ]),
      }
    }

    void requestRef.current.promise.then(([overtime, overdue]) => {
      if (!active) return

      if (overtime.ok) setMonthOvertime(overtime.data)
      if (overdue.ok) setOverdueTodos(overdue.data)

      setErrors({
        overtime: overtime.ok ? '' : overtime.error,
        overdueTodos: overdue.ok ? '' : overdue.error,
      })
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [tick])

  // 자정에 오늘/월간 데이터를 다시 가져오고, 다른 탭에 다녀온 경우에도 최신 상태로 맞춘다.
  useEffect(() => {
    let midnightTimer: number

    const scheduleMidnightRefresh = () => {
      window.clearTimeout(midnightTimer)
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2)
      const delay = Math.max(nextMidnight.getTime() - now.getTime(), 1000)
      midnightTimer = window.setTimeout(() => {
        refresh()
        scheduleMidnightRefresh()
      }, delay)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh()
        scheduleMidnightRefresh()
      }
    }

    scheduleMidnightRefresh()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearTimeout(midnightTimer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refresh])

  return {
    todayDate,
    monthOvertime,
    overdueTodos,
    loading,
    errors,
    refreshVersion,
    refreshSummary,
    refresh,
  }
}
