import { apiFetch } from './client'

export interface PackingItem {
  id?: number
  name: string
  width: number
  height: number
  quantity: number
  /** 물품 목록에서의 순서. 이 컬럼이 생기기 전 시나리오는 없을 수 있다. */
  sortOrder?: number | null
}

export interface PackingScenario {
  id?: number
  name: string
  description?: string
  truckWidth: number
  truckHeight: number
  allowRotate: boolean
  margin: number
  /** 적재 시 물품 목록 순서를 그대로 쓸지 */
  preserveOrder: boolean
  isFavorite: boolean
  createdAt?: string
  updatedAt?: string
  items: PackingItem[]
}

export interface CreateScenarioRequest {
  name: string
  description?: string
  truckWidth: number
  truckHeight: number
  allowRotate: boolean
  margin: number
  preserveOrder: boolean
  items: PackingItem[]
}

export interface UpdateScenarioRequest extends CreateScenarioRequest {}

// 모든 시나리오 조회
export async function getAllScenarios(): Promise<PackingScenario[]> {
  return await apiFetch('/api/scenarios')
}

// 즐겨찾기 시나리오 조회
export async function getFavoriteScenarios(): Promise<PackingScenario[]> {
  return await apiFetch('/api/scenarios/favorites')
}

// 시나리오 검색
export async function searchScenarios(query: string): Promise<PackingScenario[]> {
  return await apiFetch(`/api/scenarios/search?q=${encodeURIComponent(query)}`)
}

// 특정 시나리오 조회
export async function getScenario(id: number): Promise<PackingScenario> {
  return await apiFetch(`/api/scenarios/${id}`)
}

// 시나리오 생성
export async function createScenario(request: CreateScenarioRequest): Promise<PackingScenario> {
  return await apiFetch('/api/scenarios', {
    method: 'POST',
    body: JSON.stringify(request)
  })
}

// 시나리오 수정
export async function updateScenario(id: number, request: UpdateScenarioRequest): Promise<PackingScenario> {
  return await apiFetch(`/api/scenarios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(request)
  })
}

// 즐겨찾기 토글
export async function toggleFavorite(id: number): Promise<PackingScenario> {
  return await apiFetch(`/api/scenarios/${id}/favorite`, {
    method: 'PATCH'
  })
}

// 시나리오 삭제
export async function deleteScenario(id: number): Promise<void> {
  return await apiFetch(`/api/scenarios/${id}`, {
    method: 'DELETE'
  })
}
