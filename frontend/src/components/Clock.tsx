import { useEffect, useState } from 'react'
import { getWeekNumber, KOREA_TIME_ZONE } from '../utils/formatDate'

export default function Clock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dateString = now.toLocaleDateString('ko-KR', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
  const clockParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: KOREA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const getClockPart = (type: Intl.DateTimeFormatPartTypes) =>
    clockParts.find((part) => part.type === type)?.value ?? '00'
  const hhmm = `${getClockPart('hour')}:${getClockPart('minute')}`
  const seconds = getClockPart('second')
  const calendarParts = new Intl.DateTimeFormat('en-US', {
    timeZone: KOREA_TIME_ZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const getCalendarPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(calendarParts.find((part) => part.type === type)?.value ?? 0)
  // 주차 계산은 Date의 로컬 날짜 getter를 쓰므로 정오에 고정해 날짜가 밀리지 않게 한다.
  const koreaDate = new Date(
    getCalendarPart('year'),
    getCalendarPart('month') - 1,
    getCalendarPart('day'),
    12,
  )

  return (
    <>
      <div className="fl-card-head fl-plain">
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fl-muted)' }}>{dateString}</span>
        <span className="fl-badge fl-tone-primary">{getWeekNumber(koreaDate)}주차</span>
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
