import { useCallback, useEffect, useState } from 'react'

// 헤더와 인증 화면(AuthShell)이 각각 테마 토글을 갖고 있어서 state·localStorage·
// data-theme 적용을 한 곳으로 모았다. 어디서 토글해도 같은 키를 쓴다.
export default function useTheme() {
  const [theme, setTheme] = useState<string>(() => localStorage.getItem('theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'light')
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('theme', next)
      return next
    })
  }, [])

  return { theme, toggle }
}
