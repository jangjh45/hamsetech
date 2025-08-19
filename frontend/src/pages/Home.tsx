import {} from 'react'
import Clock from '../components/Clock'
import CalendarWidget from '../components/CalendarWidget'
import WeatherWidget from '../components/WeatherWidget'

export default function HomePage() {
  // reserved
  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 960, width: '100%', margin: '0 auto' }}>
        <h1 className="title">환영합니다</h1>
        <p className="subtitle">서비스에 오신 것을 환영합니다.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16 }}>
          <div className="card" style={{ padding: 16 }}>
            <Clock />
          </div>
          <div className="card" style={{ padding: 16 }}>
            <WeatherWidget />
          </div>
          <div className="card" style={{ gridColumn: '1 / span 2', padding: 16 }}>
            <CalendarWidget />
          </div>
        </div>
      </div>
    </div>
  )
}


