import { useEffect, useState } from 'react'

export default function Clock() {
  const [now, setNow] = useState(new Date())
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const timeString = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const dateString = now.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      gap: isMobile ? 8 : 4 
    }}>
      <div style={{ 
        fontSize: isMobile ? 28 : 40, 
        fontWeight: 700, 
        letterSpacing: 1 
      }}>
        {timeString}
      </div>
      <div style={{ 
        opacity: 0.8,
        fontSize: isMobile ? 12 : 14,
        textAlign: 'center',
        lineHeight: 1.2
      }}>
        {dateString}
      </div>
    </div>
  )
}


