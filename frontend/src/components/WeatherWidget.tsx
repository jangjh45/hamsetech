import { useEffect, useState } from 'react'

type WeatherData = {
  tempC?: number
  description?: string
  location?: string
  code?: number
  emoji?: string
  error?: string
}

export default function WeatherWidget() {
  const [data, setData] = useState<WeatherData>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      try {
        const coords = await getLocation()
        const [weather, place] = await Promise.all([
          fetchOpenMeteo(coords.lat, coords.lon),
          reverseGeocode(coords.lat, coords.lon),
        ])
        if (cancelled) return
        setData({ tempC: weather.tempC, description: weather.description, location: place, code: weather.code, emoji: weatherCodeToEmoji(weather.code) })
      } catch (e: any) {
        if (cancelled) return
        setData({ error: e?.message || '날씨 정보를 가져오지 못했습니다.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  if (loading) return <div>날씨 정보를 불러오는 중...</div>
  if (data.error) return <div style={{ color: 'var(--danger,#c00)' }}>{data.error}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 9999, background: 'var(--accent-bg)', color: 'var(--accent-text)', width: 'fit-content', border: '1px solid var(--border)' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
        </svg>
        <span style={{ fontSize: 12, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{data.location}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 36, lineHeight: 1 }}>{data.emoji}</div>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>
            {Math.round(data.tempC!)}
            <span style={{ fontSize: 18, opacity: 0.8 }}>°C</span>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>{data.description}</div>
      </div>
    </div>
  )
}

function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('브라우저가 위치 정보를 지원하지 않습니다.'))
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(new Error(err.message || '위치 정보를 가져올 수 없습니다.')),
      { enableHighAccuracy: false, timeout: 10000 }
    )
  })
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<{ tempC: number; description: string; code: number }> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`
  const res = await fetch(url)
  if (!res.ok) throw new Error('날씨 API 호출 실패')
  const json = await res.json()
  const tempC = json?.current?.temperature_2m
  const code = json?.current?.weather_code
  return { tempC, description: weatherCodeToKr(code), code }
}

function weatherCodeToKr(code: number): string {
  const map: Record<number, string> = {
    0: '맑음', 1: '대체로 맑음', 2: '부분적으로 흐림', 3: '흐림',
    45: '안개', 48: '착빙 안개',
    51: '약한 이슬비', 53: '중간 이슬비', 55: '강한 이슬비',
    56: '약한 어는 이슬비', 57: '강한 어는 이슬비',
    61: '약한 비', 63: '중간 비', 65: '강한 비',
    66: '약한 어는 비', 67: '강한 어는 비',
    71: '약한 눈', 73: '중간 눈', 75: '강한 눈', 77: '싸락눈',
    80: '약한 소나기', 81: '중간 소나기', 82: '강한 소나기',
    85: '약한 소낙눈', 86: '강한 소낙눈',
    95: '천둥번개', 96: '약한 우박 동반 천둥', 99: '강한 우박 동반 천둥',
  }
  return map[code] ?? '날씨 정보'
}

function weatherCodeToEmoji(code: number): string {
  if ([0].includes(code)) return '☀️'
  if ([1, 2].includes(code)) return '🌤️'
  if ([3].includes(code)) return '☁️'
  if ([45, 48].includes(code)) return '🌫️'
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return '🌧️'
  if ([66, 67].includes(code)) return '🌧️'
  if ([71, 73, 75, 77, 85, 86].includes(code)) return '❄️'
  if ([95, 96, 99].includes(code)) return '⛈️'
  return '🌡️'
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`
  const res = await fetch(url, { headers: { 'Accept-Language': 'ko' } })
  if (!res.ok) return '현재 위치'
  const json: any = await res.json()
  const addr = json?.address || {}
  const cityOrCounty = addr.city || addr.county || undefined
  const gu = addr.city_district || addr.district || addr.borough || undefined
  const emd = addr.suburb || addr.neighbourhood || addr.town || addr.village || addr.hamlet || undefined
  const parts: string[] = []
  if (cityOrCounty) parts.push(cityOrCounty)
  if (gu && gu !== cityOrCounty) parts.push(gu)
  if (emd && emd !== gu && emd !== cityOrCounty) parts.push(emd)
  const label = parts.join(' ')
  return label || json?.display_name || '현재 위치'
}


