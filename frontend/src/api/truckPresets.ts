import { apiFetch } from './client'

/** 적재함 프리셋 (차량 적재함 내측 치수, mm) */
export interface TruckPreset {
  id: number
  label: string
  width: number
  height: number
  sortOrder: number
}

export interface TruckPresetRequest {
  label: string
  width: number
  height: number
  sortOrder: number
}

// 프리셋 목록 (로그인한 사용자 누구나)
export async function getTruckPresets(): Promise<TruckPreset[]> {
  return await apiFetch('/api/truck-presets')
}

// 프리셋 생성 (관리자)
export async function createTruckPreset(request: TruckPresetRequest): Promise<TruckPreset> {
  return await apiFetch('/api/admin/truck-presets', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

// 프리셋 수정 (관리자)
export async function updateTruckPreset(id: number, request: TruckPresetRequest): Promise<TruckPreset> {
  return await apiFetch(`/api/admin/truck-presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request),
  })
}

// 프리셋 삭제 (관리자). 저장된 시나리오에는 영향이 없다.
export async function deleteTruckPreset(id: number): Promise<void> {
  return await apiFetch(`/api/admin/truck-presets/${id}`, { method: 'DELETE' })
}
