import { useEffect, useState } from 'react'
import { getTruckPresets } from '../api/truckPresets'
import { FALLBACK_TRUCK_PRESETS, type TruckDims } from '../components/delivery/deliveryShared'

/**
 * 적재함 프리셋 목록. 서버 목록을 받으면 그것을 쓰고, 받지 못하면 기본 목록을 쓴다.
 * 조회가 실패해도 화면은 프리셋 버튼을 잃지 않는다.
 */
export function useTruckPresets(): TruckDims[] {
  const [presets, setPresets] = useState<TruckDims[]>(FALLBACK_TRUCK_PRESETS)

  useEffect(() => {
    let cancelled = false
    getTruckPresets()
      .then((list) => {
        if (!cancelled) setPresets(list)
      })
      .catch(() => {
        // 기본 목록을 그대로 쓴다
      })
    return () => {
      cancelled = true
    }
  }, [])

  return presets
}
