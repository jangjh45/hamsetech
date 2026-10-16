import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { listEvents, type CalendarEvent } from '../api/calendar'
import { listTodos, type Todo } from '../api/todos'
import { MonthDataContext, monthKey, type MonthEntry } from '../contexts/HomeMonthDataContext'

function errorText(error: unknown): string {
  return error instanceof Error && error.message ? error.message : '데이터를 불러오지 못했습니다.'
}

export default function HomeMonthDataProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Record<string, MonthEntry>>({})
  const [retryVersions, setRetryVersions] = useState<Record<string, number>>({})
  const requestId = useRef(0)
  const mounted = useRef(true)
  const activeRequests = useRef(new Map<string, { version: string; id: number }>())
  const loadedVersions = useRef(new Map<string, string>())

  const loadMonth = useCallback((start: string, end: string, version: string) => {
    const key = monthKey(start, end)
    if (loadedVersions.current.get(key) === version) return
    if (activeRequests.current.get(key)?.version === version) return

    const id = ++requestId.current
    activeRequests.current.set(key, { version, id })
    setEntries((current) => {
      const previous = current[key]
      return {
        ...current,
        [key]: {
          version,
          events: previous?.events ?? null,
          todos: previous?.todos ?? null,
          eventsLoading: true,
          todosLoading: true,
          eventsError: '',
          todosError: '',
        },
      }
    })

    const capture = async <T,>(promise: Promise<T>): Promise<{ data: T } | { error: string }> => {
      try {
        return { data: await promise }
      } catch (error) {
        return { error: errorText(error) }
      }
    }

    void Promise.all([
      capture(listEvents(start, end)),
      capture(listTodos(start, end)),
    ]).then(([events, todos]) => {
      if (!mounted.current || activeRequests.current.get(key)?.id !== id) return
      activeRequests.current.delete(key)
      loadedVersions.current.set(key, version)

      setEntries((current) => {
        const previous = current[key]
        return {
          ...current,
          [key]: {
            version,
            events: 'data' in events ? events.data : previous?.events ?? null,
            todos: 'data' in todos ? todos.data : previous?.todos ?? null,
            eventsLoading: false,
            todosLoading: false,
            eventsError: 'error' in events ? events.error : '',
            todosError: 'error' in todos ? todos.error : '',
          },
        }
      })
    })
  }, [])

  const updateEvents = useCallback((start: string, end: string, update: (previous: CalendarEvent[]) => CalendarEvent[]) => {
    const key = monthKey(start, end)
    setEntries((current) => {
      const previous = current[key]
      return {
        ...current,
        [key]: {
          version: previous?.version ?? '',
          events: update(previous?.events ?? []),
          todos: previous?.todos ?? null,
          eventsLoading: previous?.eventsLoading ?? false,
          todosLoading: previous?.todosLoading ?? false,
          eventsError: previous?.eventsError ?? '',
          todosError: previous?.todosError ?? '',
        },
      }
    })
  }, [])

  const updateTodos = useCallback((start: string, end: string, update: (previous: Todo[]) => Todo[]) => {
    const key = monthKey(start, end)
    setEntries((current) => {
      const previous = current[key]
      return {
        ...current,
        [key]: {
          version: previous?.version ?? '',
          events: previous?.events ?? null,
          todos: update(previous?.todos ?? []),
          eventsLoading: previous?.eventsLoading ?? false,
          todosLoading: previous?.todosLoading ?? false,
          eventsError: previous?.eventsError ?? '',
          todosError: previous?.todosError ?? '',
        },
      }
    })
  }, [])

  const retryMonth = useCallback((start: string, end: string) => {
    const key = monthKey(start, end)
    setRetryVersions((current) => ({ ...current, [key]: (current[key] ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  return (
    <MonthDataContext.Provider value={{ entries, retryVersions, loadMonth, retryMonth, updateEvents, updateTodos }}>
      {children}
    </MonthDataContext.Provider>
  )
}
