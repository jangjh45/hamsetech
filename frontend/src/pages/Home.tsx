import { useState, useEffect } from 'react'
import Clock from '../components/Clock'
import CalendarWidget from '../components/CalendarWidget'
import TodoList from '../components/TodoList'

function toYmd(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function HomePage() {
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [viewDate, setViewDate] = useState<Date>(new Date())
  const [selected, setSelected] = useState<string>(toYmd(new Date()))

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 월의 시작과 끝 날짜 계산
  const monthStart = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth(), 1))
  const monthEnd = toYmd(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0))

  return (
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{ 
        maxWidth: isMobile ? '100%' : 1400, 
        width: '100%', 
        margin: '0 auto'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
          gap: isMobile ? 16 : 24, 
          marginTop: isMobile ? 8 : 16 
        }}>
          {/* 왼쪽: 시계 + 캘린더 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 16 : 20,
            width: '100%'
          }}>
            <div className="card" style={{ padding: isMobile ? 12 : 16 }}>
              <Clock />
            </div>
            <div className="card" style={{ padding: isMobile ? 12 : 16 }}>
              <CalendarWidget 
                viewDate={viewDate}
                setViewDate={setViewDate}
                selected={selected}
                setSelected={setSelected}
              />
            </div>
          </div>

          {/* 오른쪽: 일정관리 + 할 일 */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? 16 : 20,
            width: '100%'
          }}>
            <div className="card" style={{ padding: isMobile ? 12 : 16 }}>
              <TodoList 
                selectedDate={selected}
                monthStart={monthStart}
                monthEnd={monthEnd}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


