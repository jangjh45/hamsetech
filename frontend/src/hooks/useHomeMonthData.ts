import { useCallback, useContext, useEffect } from 'react'
import type { CalendarEvent } from '../api/calendar'
import type { Todo } from '../api/todos'
import { MonthDataContext, monthKey, type ArrayUpdater, type MonthEntry } from '../contexts/HomeMonthDataContext'

export interface HomeMonthData extends MonthEntry {
  retry: () => void
  updateEvents: (update: ArrayUpdater<CalendarEvent>) => void
  updateTodos: (update: ArrayUpdater<Todo>) => void
}

export function useHomeMonthData(start: string, end: string, refreshVersion: number): HomeMonthData {
  const context = useContext(MonthDataContext)
  if (!context) throw new Error('useHomeMonthData는 HomeMonthDataProvider 안에서 사용해야 합니다.')

  const { entries, retryVersions, loadMonth, retryMonth, updateEvents: updateMonthEvents, updateTodos: updateMonthTodos } = context
  const key = monthKey(start, end)
  const version = `${refreshVersion}:${retryVersions[key] ?? 0}`

  useEffect(() => {
    loadMonth(start, end, version)
  }, [loadMonth, start, end, version])

  const entry = entries[key]
  const currentVersion = entry?.version === version

  const retry = useCallback(() => retryMonth(start, end), [retryMonth, start, end])
  const updateEvents = useCallback(
    (update: ArrayUpdater<CalendarEvent>) => updateMonthEvents(start, end, update),
    [updateMonthEvents, start, end],
  )
  const updateTodos = useCallback(
    (update: ArrayUpdater<Todo>) => updateMonthTodos(start, end, update),
    [updateMonthTodos, start, end],
  )

  return {
    version,
    events: entry?.events ?? null,
    todos: entry?.todos ?? null,
    eventsLoading: !currentVersion || entry.eventsLoading,
    todosLoading: !currentVersion || entry.todosLoading,
    eventsError: currentVersion ? entry.eventsError : '',
    todosError: currentVersion ? entry.todosError : '',
    retry,
    updateEvents,
    updateTodos,
  }
}
