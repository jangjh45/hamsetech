import { useEffect, useState } from 'react'

const MOBILE_BREAKPOINT = 768

// 화면 폭 기준 모바일 여부. 각 컴포넌트에 복붙되어 있던 resize 리스너를 대체한다.
// CSS 미디어 쿼리로 해결되는 스타일 분기에는 쓰지 말고, 렌더 구조 자체가
// 달라지는 곳(예: 헤더의 햄버거 메뉴)에서만 사용한다.
export default function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => window.innerWidth < MOBILE_BREAKPOINT)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return isMobile
}
