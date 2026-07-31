import { useEffect, useState } from 'react'
import { getWeekNumber } from '../utils/formatDate'

export default function Clock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const dateString = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <>
      <div className="fl-card-head fl-plain">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fl-muted)' }}>{dateString}</span>
        <span className="fl-badge fl-tone-primary">{getWeekNumber(now)}주차</span>
      </div>

      <div className="fl-card-body" style={{ justifyContent: 'flex-end' }}>
        <div className="fl-clock">
          <span className="fl-clock-time">{hhmm}</span>
          <span className="fl-clock-sec">{seconds}</span>
        </div>
      </div>
    </>
  )
}
