import { useState, useEffect } from 'react'
import Clock from '../components/Clock'
import CalendarWidget from '../components/CalendarWidget'
import WeatherWidget from '../components/WeatherWidget'

export default function HomePage() {
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{ 
        maxWidth: 960, 
        width: '100%', 
        margin: '0 auto',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', 
          gap: isMobile ? 16 : 24, 
          marginTop: isMobile ? 8 : 16 
        }}>
          <div className="card" style={{ padding: isMobile ? 12 : 16 }}>
            <Clock />
          </div>
          <div className="card" style={{ padding: isMobile ? 12 : 16 }}>
            <WeatherWidget />
          </div>
          <div className="card" style={{ 
            gridColumn: isMobile ? '1' : '1 / span 2', 
            padding: isMobile ? 12 : 16 
          }}>
            <CalendarWidget />
          </div>
        </div>
      </div>
    </div>
  )
}


