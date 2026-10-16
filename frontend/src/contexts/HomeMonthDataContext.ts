import { createContext } from 'react'
import type { CalendarEvent } from '../api/calendar'
import type { Todo } from '../api/todos'

export interface MonthEntry {
  version: string
  events: CalendarEvent[] | null
  todos: Todo[] | null
  eventsLoading: boolean
  todosLoading: boolean
  eventsError: string
  todosError: string
}

export type ArrayUpdater<T> = (previous: T[]) => T[]

export interface MonthDataContextValue {
  entries: Record<string, MonthEntry>
  retryVersions: Record<string, number>
  loadMonth: (start: string, end: string, version: string) => void
  retryMonth: (start: string, end: string) => void
  updateEvents: (start: string, end: string, update: ArrayUpdater<CalendarEvent>) => void
  updateTodos: (start: string, end: string, update: ArrayUpdater<Todo>) => void
}

export const MonthDataContext = createContext<MonthDataContextValue | null>(null)

export function monthKey(start: string, end: string): string {
  return `${start}|${end}`
}
