import { useEffect, useMemo, useState } from 'react'
import { listEvents, createEvent, deleteEvent } from '../api/calendar'

type CalendarEvent = { id: number | string; date: string; title: string; time?: string }

interface CalendarWidgetProps {
  viewDate: Date
  setViewDate: (date: Date) => void
  selected: string
  setSelected: (date: string) => void
}

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

  const cells: Array<{ d: number | null; date?: string; isToday: boolean }> = []
  const prevMonthDays = new Date(year, month, 0).getDate()
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

function loadEventsLocal(): CalendarEvent[] { try { return JSON.parse(localStorage.getItem('calendarEvents') || '[]') } catch { return [] } }
function saveEventsLocal(events: CalendarEvent[]) { localStorage.setItem('calendarEvents', JSON.stringify(events)) }

export default function CalendarWidget({ viewDate, setViewDate, selected, setSelected }: CalendarWidgetProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [newTitle, setNewTitle] = useState('')
  const [newTime, setNewTime] = useState('')
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => { setEvents(loadEventsLocal()) }, [])
  useEffect(() => { saveEventsLocal(events) }, [events])

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    <div style={{ 
      width: '100%',
      maxWidth: '100%',
      overflow: 'hidden',
      boxSizing: 'border-box'
    }}>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: 8,
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 8 : 0
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? 4 : 8 
        }}>
          <button className="btn ghost" onClick={prevMonth}>◀</button>
          <button className="btn ghost" onClick={goToday}>오늘</button>
          <button className="btn ghost" onClick={nextMonth}>▶</button>
        </div>
        <div style={{ 
          fontSize: isMobile ? 16 : 18, 
          fontWeight: 600,
          textAlign: 'center'
        }}>
          {monthLabel}
        </div>
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(7, 1fr)', 
        gap: isMobile ? 2 : 4, 
        textAlign: 'center' 
      }}>
        {['일','월','화','수','목','금','토'].map((w) => (
          <div key={w} style={{ 
            fontSize: isMobile ? 10 : 12, 
            opacity: 0.7 
          }}>
            {w}
          </div>
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
                padding: isMobile ? '4px 0' : '8px 0',
                borderRadius: isMobile ? 4 : 8,
                background: cell.isToday ? 'var(--accent-bg)' : (isSelected ? 'rgba(109,139,255,0.12)' : 'transparent'),
                fontWeight: cell.isToday ? 700 : 500,
                color: cell.d ? (cell.isToday ? 'var(--accent-text)' : 'inherit') : 'transparent',
                border: (cell.isToday || isSelected) ? '1px solid var(--primary)' : '1px solid transparent',
                cursor: cell.d ? 'pointer' : 'default',
                fontSize: isMobile ? 12 : 14
              }}
            >
              <div style={{ position: 'relative', display: 'inline-block', minWidth: isMobile ? 16 : 20 }}>
                {cell.d ?? '0'}
                {hasEvents && <span style={{ 
                  position: 'absolute', 
                  right: isMobile ? -4 : -6, 
                  top: isMobile ? -1 : -2, 
                  width: isMobile ? 4 : 6, 
                  height: isMobile ? 4 : 6, 
                  background: 'var(--primary)', 
                  borderRadius: 9999 
                }} />}
              </div>
            </button>
          )
        })}
      </div>
      <div style={{ marginTop: isMobile ? 12 : 16, display: 'grid', gap: isMobile ? 8 : 10 }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'baseline', 
          justifyContent: 'space-between',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 4 : 0
        }}>
          <div style={{ 
            fontWeight: 700,
            fontSize: isMobile ? 14 : 16,
            textAlign: isMobile ? 'center' : 'left'
          }}>
            일정
          </div>
          <div style={{ 
            opacity: 0.7,
            fontSize: isMobile ? 12 : 14,
            textAlign: isMobile ? 'center' : 'right'
          }}>
            {eventsByDate[selected]?.length || 0}개 일정
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          gap: isMobile ? 8 : 8, 
          alignItems: 'stretch',
          flexDirection: 'column',
          width: '100%',
          maxWidth: '100%',
          overflow: 'visible'
        }}>
          <input 
            className="input" 
            placeholder="일정 제목" 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)} 
            style={{ 
              flex: '0 0 auto',
              width: '100%',
              fontSize: isMobile ? 14 : 16,
              padding: isMobile ? '8px 12px' : '10px 16px',
              boxSizing: 'border-box'
            }} 
          />
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? 8 : 8,
            alignItems: 'stretch',
            flexDirection: isMobile ? 'row' : 'row',
            width: '100%',
            flexShrink: 0
          }}>
            <input 
              className="input" 
              type="time" 
              value={newTime} 
              onChange={(e) => setNewTime(e.target.value)} 
              style={{ 
                flex: isMobile ? '1 1 auto' : '0 1 140px',
                minWidth: isMobile ? '100px' : '140px',
                fontSize: isMobile ? 14 : 16,
                padding: isMobile ? '8px 12px' : '10px 16px',
                boxSizing: 'border-box'
              }} 
            />
            <button 
              className="btn ghost" 
              onClick={addEvent}
              style={{ 
                flex: isMobile ? '0 0 auto' : '0 0 auto',
                width: isMobile ? 'auto' : 'auto',
                minWidth: '80px',
                fontSize: isMobile ? 14 : 16,
                padding: isMobile ? '8px 16px' : '10px 20px',
                flexShrink: 0
              }}
            >
              추가
            </button>
          </div>
        </div>
        <div className="card" style={{ display: 'grid', gap: isMobile ? 6 : 8 }}>
          {(eventsByDate[selected] || []).length === 0 && (
            <div style={{ 
              opacity: 0.6,
              textAlign: 'center',
              fontSize: isMobile ? 12 : 14
            }}>
              등록된 일정이 없습니다.
            </div>
          )}
          {(eventsByDate[selected] || []).map((ev) => (
            <div key={ev.id} style={{ 
              display: 'flex', 
              alignItems: isMobile ? 'flex-start' : 'center', 
              justifyContent: 'space-between', 
              borderBottom: '1px dashed var(--border)', 
              paddingBottom: isMobile ? 8 : 6,
              flexDirection: isMobile ? 'row' : 'row',
              gap: isMobile ? 8 : 0,
              width: '100%'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: isMobile ? 6 : 10,
                flexDirection: isMobile ? 'column' : 'row',
                textAlign: isMobile ? 'center' : 'left',
                flex: isMobile ? 1 : 'initial'
              }}>
                <span style={{ 
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
                  opacity: 0.8, 
                  minWidth: isMobile ? 40 : 52,
                  fontSize: isMobile ? 12 : 14
                }}>
                  {ev.time || '--:--'}
                </span>
                <span style={{ fontSize: isMobile ? 14 : 16 }}>{ev.title}</span>
              </div>
              <button 
                className="btn ghost" 
                onClick={() => removeEvent(ev.id)}
                style={{ 
                  padding: isMobile ? '4px 8px' : '8px 14px',
                  fontSize: isMobile ? '18px' : '14px',
                  flexShrink: 0,
                  minWidth: isMobile ? '32px' : '60px',
                  height: isMobile ? '32px' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  lineHeight: 1,
                  transform: isMobile ? 'translateY(1.5px)' : 'none'
                }}
                title={isMobile ? '일정 삭제' : ''}
              >
                {isMobile ? '×' : '삭제'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 
