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
        {/* 일정 추가 폼 - 개선된 디자인 */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(109, 139, 255, 0.08) 0%, rgba(109, 139, 255, 0.04) 100%)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          padding: isMobile ? '16px' : '20px',
          display: 'grid',
          gap: isMobile ? '10px' : '12px'
        }}>
          <div style={{
            fontSize: isMobile ? '13px' : '14px',
            fontWeight: '600',
            color: 'var(--primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            opacity: 0.9
          }}>
            ➕ 새 일정 추가
          </div>
          
          <input 
            className="input input-event" 
            placeholder="일정 제목을 입력하세요" 
            value={newTitle} 
            onChange={(e) => setNewTitle(e.target.value)} 
            style={{ 
              flex: '0 0 auto',
              width: '100%',
              fontSize: isMobile ? '15px' : '16px',
              padding: isMobile ? '10px 14px' : '12px 16px',
              boxSizing: 'border-box',
              fontWeight: '500'
            }} 
          />
          
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? '10px' : '12px',
            alignItems: 'stretch',
            flexDirection: isMobile ? 'column' : 'row',
            width: '100%',
            flexShrink: 0
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: isMobile ? 'none' : '0 0 auto'
            }}>
              <span style={{
                fontSize: isMobile ? '14px' : '14px',
                opacity: 0.7,
                whiteSpace: 'nowrap'
              }}>
                ⏰
              </span>
              <input 
                className="input input-event" 
                type="time" 
                value={newTime} 
                onChange={(e) => setNewTime(e.target.value)} 
                style={{ 
                  flex: '1',
                  fontSize: isMobile ? '14px' : '16px',
                  padding: isMobile ? '10px 12px' : '12px 14px',
                  boxSizing: 'border-box'
                }} 
              />
            </div>
            
            {!isMobile && <div style={{ flex: 1 }} />}
            
            <button 
              className="btn btn-add-event" 
              onClick={addEvent}
              style={{ 
                flex: isMobile ? '1' : '0 0 auto',
                minWidth: isMobile ? 'auto' : '100px',
                fontSize: isMobile ? '15px' : '16px',
                padding: isMobile ? '10px 16px' : '12px 24px',
                flexShrink: 0,
                fontWeight: '600',
                letterSpacing: '0.3px'
              }}
            >
              추가
            </button>
          </div>
        </div>
        
        {/* 일정 목록 */}
        <div className="card" style={{ 
          display: 'flex',
          flexDirection: 'column',
          gap: isMobile ? 8 : 10,
          maxHeight: isMobile ? '400px' : '600px',
          overflow: 'hidden'
        }}>
          {(eventsByDate[selected] || []).length === 0 && (
            <div style={{ 
              opacity: 0.6,
              textAlign: 'center',
              fontSize: isMobile ? 12 : 14,
              padding: isMobile ? '20px 0' : '24px 0'
            }}>
              등록된 일정이 없습니다.
            </div>
          )}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 8 : 10,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingRight: isMobile ? '4px' : '6px',
            minWidth: 0
          }}>
            {(eventsByDate[selected] || []).map((ev) => (
              <div key={ev.id} className="event-item" style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                background: 'rgba(109, 139, 255, 0.05)',
                border: '1px solid rgba(109, 139, 255, 0.15)',
                borderRadius: '10px',
                padding: isMobile ? '12px' : '14px',
                flexDirection: 'row',
                gap: isMobile ? 8 : 12,
                width: '100%',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                boxSizing: 'border-box',
                flexShrink: 0
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: isMobile ? 8 : 12,
                  flex: 1,
                  minWidth: 0
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 6 : 8,
                    flex: 1,
                    minWidth: 0
                  }}>
                    <span style={{ 
                      fontSize: isMobile ? '14px' : '16px',
                      fontWeight: '500',
                      color: 'var(--text)',
                      wordBreak: 'break-word',
                      flex: 1
                    }}>
                      {ev.title}
                    </span>
                    <span style={{ 
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace', 
                      opacity: 0.7, 
                      fontSize: isMobile ? '12px' : '13px',
                      color: 'var(--muted)',
                      flexShrink: 0,
                      whiteSpace: 'nowrap'
                    }}>
                      {ev.time || '시간 미설정'}
                    </span>
                  </div>
                </div>

                <button 
                  className="btn-delete-event" 
                  onClick={() => removeEvent(ev.id)}
                  style={{ 
                    padding: isMobile ? '6px 10px' : '8px 14px',
                    fontSize: isMobile ? '14px' : '14px',
                    flexShrink: 0,
                    minWidth: isMobile ? '32px' : '60px',
                    height: isMobile ? '32px' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1
                  }}
                  title={isMobile ? '삭제' : ''}
                >
                  {isMobile ? '×' : '삭제'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 
