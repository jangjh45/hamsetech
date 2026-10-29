import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTruckPresets } from './useTruckPresets'
import { FALLBACK_TRUCK_PRESETS } from '../components/delivery/deliveryShared'

const truckPresetApi = vi.hoisted(() => ({
  getTruckPresets: vi.fn(),
}))

vi.mock('../api/truckPresets', () => truckPresetApi)

beforeEach(() => {
  truckPresetApi.getTruckPresets.mockReset()
})

describe('useTruckPresets', () => {
  it('서버가 준 프리셋 목록을 쓴다', async () => {
    truckPresetApi.getTruckPresets.mockResolvedValue([
      { id: 7, label: '3톤 카고', width: 3500, height: 1800, sortOrder: 0 },
    ])

    const { result } = renderHook(() => useTruckPresets())

    await waitFor(() => {
      expect(result.current).toEqual([{ id: 7, label: '3톤 카고', width: 3500, height: 1800, sortOrder: 0 }])
    })
  })

  it('조회가 실패하면 기본 목록으로 남는다', async () => {
    truckPresetApi.getTruckPresets.mockRejectedValue(new Error('network'))

    const { result } = renderHook(() => useTruckPresets())

    await waitFor(() => expect(truckPresetApi.getTruckPresets).toHaveBeenCalled())
    expect(result.current).toEqual(FALLBACK_TRUCK_PRESETS)
  })
})
