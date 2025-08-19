import { useEffect, useMemo, useState } from 'react'
import { listEvents, createEvent, deleteEvent } from '../api/calendar'

type CalendarEvent = { id: number | string; date: string; title: string; time?: string }

function toYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getMonthMatrix(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startDay = first.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  // 항상 6주(42칸)로 고정
  const cells: Array<{ d: number | null; date?: string; isToday: boolean }> = []
  const prevMonthDays = new Date(year, month, 0).getDate()
  // 이전 달의 말일에서부터 채우기
  for (let i = startDay - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const dt = new Date(year, month - 1, day)
    cells.push({ d: null, date: toYmd(dt), isToday: false })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const thisDate = new Date(year, month, d)
    cells.push({ d, date: toYmd(thisDate), isToday: new Date().toDateString() === thisDate.toDateString() })
  }
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++) {
    const dt = new Date(year, month + 1, i)
    cells.push({ d: null, date: toYmd(dt), isToday: false })
  }
  return cells
}

// 클라이언트 캐시 (옵션)
function loadEventsLocal(): CalendarEvent[] { try { return JSON.parse(localStorage.getItem('calendarEvents') || '[]') } catch { return [] } }
function saveEventsLocal(events: CalendarEvent[]) { localStorage.setItem('calendarEvents', JSON.stringify(events)) }

export default function CalendarWidget() {
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<string>(toYmd(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('')

  useEffect(() => { setEvents(loadEventsLocal()) }, [])
  useEffect(() => { saveEventsLocal(events) }, [events])

  useEffect(() => {
    const y = viewDate.getFullYear()
    const m = viewDate.getMonth()
    const start = toYmd(new Date(y, m, 1))
    const end = toYmd(new Date(y, m + 1, 0))
    listEvents(start, end).then((server) => {
      setEvents(server)
    }).catch(() => {})
  }, [viewDate])

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
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

  function prevMonth() { setViewDate(new Date(year, month - 1, 1)) }
  function nextMonth() { setViewDate(new Date(year, month + 1, 1)) }
  function goToday() { const t = new Date(); setViewDate(new Date(t.getFullYear(), t.getMonth(), 1)); setSelected(toYmd(t)) }

  async function addEvent() {
    if (!newTitle.trim()) return
    const payload = { date: selected, title: newTitle.trim(), time: newTime || undefined }
    try {
      const created = await createEvent(payload)
      setEvents((prev) => [...prev, created])
      setNewTitle('')
      setNewTime('')
    } catch {}
  }

  async function removeEvent(id: number | string) {
    try {
      await deleteEvent(Number(id))
      setEvents((prev) => prev.filter((e) => e.id !== id))
    } catch {}
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn ghost" onClick={prevMonth}>◀</button>
          <button className="btn ghost" onClick={goToday}>오늘</button>
          <button className="btn ghost" onClick={nextMonth}>▶</button>
        </div>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{monthLabel}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
        {['일','월','화','수','목','금','토'].map((w) => (
          <div key={w} style={{ fontSize: 12, opacity: 0.7 }}>{w}</div>
        ))}
        {matrix.map((cell, idx) => {
          const hasEvents = !!(cell.date && eventsByDate[cell.date]?.length)
          const isSelected = cell.date === selected
          return (
            <button
              key={idx}
              onClick={() => { if (cell.date) setSelected(cell.date) }}
              disabled={!cell.d}
              style={{
                padding: '8px 0',
                borderRadius: 8,
                background: cell.isToday ? 'var(--accent-bg)' : (isSelected ? 'rgba(109,139,255,0.12)' : 'transparent'),
                fontWeight: cell.isToday ? 700 : 500,
                color: cell.d ? (cell.isToday ? 'var(--accent-text)' : 'inherit') : 'transparent',
                border: (cell.isToday || isSelected) ? '1px solid var(--primary)' : '1px solid transparent',
                cursor: cell.d ? 'pointer' : 'default'
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block', minWidth: 20 }}>
                {cell.d ?? '0'}
                {hasEvents && <span style={{ position: 'absolute', right: -6, top: -2, width: 6, height: 6, background: 'var(--primary)', borderRadius: 9999 }} />}
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700 }}>{new Date(selected).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
          <div style={{ opacity: 0.7 }}>{eventsByDate[selected]?.length || 0}개 일정</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input className="input" placeholder="일정 제목" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ flex: 1 }} />
          <input className="input" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} style={{ width: 140 }} />
          <button className="btn ghost" onClick={addEvent}>추가</button>
        </div>
        <div className="card" style={{ display: 'grid', gap: 8 }}>
          {(eventsByDate[selected] || []).length === 0 && <div style={{ opacity: 0.6 }}>등록된 일정이 없습니다.</div>}
          {(eventsByDate[selected] || []).map((ev) => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', opacity: 0.8, minWidth: 52 }}>
                  {ev.time || '--:--'}
                </span>
                <span>{ev.title}</span>
              </div>
              <button className="btn ghost" onClick={() => removeEvent(ev.id)}>삭제</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}


