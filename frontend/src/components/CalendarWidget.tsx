import { useEffect, useMemo, useState } from 'react'
import {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  canEditEvent,
  type CalendarEvent,
  type CalendarScope,
} from '../api/calendar'
import { toYmd, formatTime } from '../utils/formatDate'

interface CalendarWidgetProps {
  viewDate: Date
  setViewDate: (date: Date) => void
  selected: string
  setSelected: (date: string) => void
  /** 일정 추가/삭제 후 상위(타이틀 밴드, 오늘 일정 위젯) 갱신용 */
  onEventsChanged?: () => void
}

interface DayCell {
  day: number
  date: string
  isToday: boolean
  isOutside: boolean
  weekday: number
}

function getMonthMatrix(year: number, month: number): DayCell[] {
  const startDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const todayYmd = toYmd(new Date())

  const cells: DayCell[] = []
  const push = (dt: Date, isOutside: boolean) => {
    const date = toYmd(dt)
    cells.push({
      day: dt.getDate(),
      date,
      isToday: date === todayYmd,
      isOutside,
      weekday: dt.getDay(),
    })
  }

  for (let i = startDay - 1; i >= 0; i--) {
    push(new Date(year, month - 1, prevMonthDays - i), true)
  }
  for (let d = 1; d <= daysInMonth; d++) {
    push(new Date(year, month, d), false)
  }
  for (let i = 1; cells.length < 42; i++) {
    push(new Date(year, month + 1, i), true)
  }
  return cells
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const SCOPES: { value: CalendarScope; label: string }[] = [
  { value: 'PRIVATE', label: '개인' },
  { value: 'COMPANY', label: '전체 공유' },
]

function weekdayClass(weekday: number): string {
  if (weekday === 0) return ' fl-sun'
  if (weekday === 6) return ' fl-sat'
  return ''
}

export default function CalendarWidget({
  viewDate,
  setViewDate,
  selected,
  setSelected,
  onEventsChanged,
}: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('')
  const [newScope, setNewScope] = useState<CalendarScope>('PRIVATE')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editScope, setEditScope] = useState<CalendarScope>('PRIVATE')
  const [error, setError] = useState('')

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()

  useEffect(() => {
    const start = toYmd(new Date(year, month, 1))
    const end = toYmd(new Date(year, month + 1, 0))
    listEvents(start, end)
      .then(setEvents)
      .catch((e) => setError(e instanceof Error ? e.message : '일정을 불러오지 못했습니다.'))
  }, [year, month])

  // 다른 날짜/달로 이동하면 편집 중이던 행은 화면에서 사라지므로 편집 상태를 정리한다
  useEffect(() => {
    setEditingId(null)
    setError('')
  }, [selected, year, month])

  const matrix = useMemo(() => getMonthMatrix(year, month), [year, month])
  const monthLabel = viewDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long' })

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!map[e.date]) map[e.date] = []
      map[e.date].push(e)
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
    }
    return map
  }, [events])

  const selectedEvents = eventsByDate[selected] || []
  const selectedLabel = new Date(`${selected}T00:00:00`).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  })

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }
  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }
  function goToday() {
    const t = new Date()
    setViewDate(new Date(t.getFullYear(), t.getMonth(), 1))
    setSelected(toYmd(t))
  }

  async function addEvent() {
    if (!newTitle.trim()) return
    try {
      const created = await createEvent({
        date: selected,
        title: newTitle.trim(),
        time: newTime || undefined,
        scope: newScope,
      })
      setEvents((prev) => [...prev, created])
      setNewTitle('')
      setNewTime('')
      setError('')
      onEventsChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 추가하지 못했습니다.')
    }
  }

  function startEdit(ev: CalendarEvent) {
    setEditingId(ev.id)
    setEditTitle(ev.title)
    setEditTime(formatTime(ev.time))
    setEditScope(ev.scope)
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditTitle('')
    setEditTime('')
    setEditScope('PRIVATE')
  }

  async function saveEdit(ev: CalendarEvent) {
    const title = editTitle.trim()
    if (!title) return
    try {
      // 날짜는 그대로 두고 제목/시간/공개 범위만 수정한다. 시간을 비우면 종일 일정이 된다.
      const updated = await updateEvent(ev.id, {
        date: ev.date,
        title,
        time: editTime || undefined,
        scope: editScope,
      })
      setEvents((prev) => prev.map((e) => (e.id === ev.id ? updated : e)))
      cancelEdit()
      setError('')
      onEventsChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 수정하지 못했습니다.')
    }
  }

  async function removeEvent(id: number) {
    try {
      await deleteEvent(id)
      setEvents((prev) => prev.filter((e) => e.id !== id))
      if (editingId === id) cancelEdit()
      setError('')
      onEventsChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : '일정을 삭제하지 못했습니다.')
    }
  }

  return (
    <>
      <div className="fl-card-head">
        <span className="fl-card-title">{monthLabel}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button className="fl-btn-icon fl-btn-sm" onClick={prevMonth} aria-label="이전 달">
            ◀
          </button>
          <button className="fl-btn fl-btn-sm" onClick={goToday}>
            오늘
          </button>
          <button className="fl-btn-icon fl-btn-sm" onClick={nextMonth} aria-label="다음 달">
            ▶
          </button>
        </div>
      </div>

      <div className="fl-card-body">
        <div>
          <div className="fl-cal-grid" style={{ marginBottom: 6 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`fl-cal-wd${weekdayClass(i)}`}>
                {w}
              </div>
            ))}
          </div>
          <div className="fl-cal-grid">
            {matrix.map((cell) => {
              const hasEvents = !!eventsByDate[cell.date]?.length
              const classes = [
                'fl-day',
                weekdayClass(cell.weekday).trim(),
                cell.isOutside ? 'is-outside' : '',
                cell.isToday ? 'is-today' : '',
                cell.date === selected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')
              return (
                <button
                  key={cell.date}
                  className={classes}
                  onClick={() => setSelected(cell.date)}
                  disabled={cell.isOutside}
                >
                  {cell.day}
                  {hasEvents && <span className="fl-day-dot" />}
                </button>
              )
            })}
          </div>
        </div>

        <div
          style={{
            paddingTop: 16,
            borderTop: '1px solid var(--fl-divider)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedLabel} 일정</span>
            <span className="fl-card-count">{selectedEvents.length}건</span>
          </div>

          <div className="fl-form-row">
            <input
              className="fl-input"
              placeholder="일정 추가"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addEvent()}
            />
            <input
              className="fl-input"
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              aria-label="일정 시간"
            />
            <div className="fl-seg" role="group" aria-label="공개 범위">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  className={`fl-seg-btn${newScope === s.value ? ' is-active' : ''}`}
                  style={{ height: 32 }}
                  onClick={() => setNewScope(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <button className="fl-btn fl-btn-primary" onClick={addEvent} disabled={!newTitle.trim()}>
              추가
            </button>
          </div>

          {error && <div className="fl-error">{error}</div>}

          {selectedEvents.length === 0 ? (
            <div className="fl-empty">등록된 일정이 없습니다.</div>
          ) : (
            <div className="fl-list">
              {selectedEvents.map((ev) =>
                editingId === ev.id ? (
                  <div key={ev.id} className="fl-row is-editing">
                    <input
                      className="fl-input fl-row-edit-title"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(ev)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      aria-label="일정 제목"
                      autoFocus
                    />
                    <input
                      className="fl-input fl-row-edit-time"
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(ev)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      aria-label="일정 시간"
                    />
                    <div className="fl-seg" role="group" aria-label="공개 범위">
                      {SCOPES.map((s) => (
                        <button
                          key={s.value}
                          className={`fl-seg-btn${editScope === s.value ? ' is-active' : ''}`}
                          onClick={() => setEditScope(s.value)}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <button
                      className="fl-btn fl-btn-primary fl-btn-sm"
                      onClick={() => saveEdit(ev)}
                      disabled={!editTitle.trim()}
                    >
                      저장
                    </button>
                    <button className="fl-btn fl-btn-sm" onClick={cancelEdit}>
                      취소
                    </button>
                  </div>
                ) : (
                  <div key={ev.id} className="fl-row">
                    <span className="fl-row-time">{formatTime(ev.time) || '종일'}</span>
                    <span className="fl-row-title">{ev.title}</span>
                    {ev.scope === 'COMPANY' && (
                      <span
                        className="fl-badge fl-tone-primary"
                        title={
                          ev.createdByDisplayName
                            ? `${ev.createdByDisplayName} 등록 · 전 직원 공유`
                            : '전 직원 공유'
                        }
                      >
                        전체
                      </span>
                    )}
                    {canEditEvent(ev) && (
                      <>
                        <button
                          className="fl-btn-e"
                          onClick={() => startEdit(ev)}
                          title="수정"
                          aria-label="일정 수정"
                        >
                          ✎
                        </button>
                        <button
                          className="fl-btn-x"
                          onClick={() => removeEvent(ev.id)}
                          title="삭제"
                          aria-label="일정 삭제"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
