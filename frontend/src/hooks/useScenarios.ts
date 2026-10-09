import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  getAllScenarios,
  getFavoriteScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  toggleFavorite,
  type PackingScenario,
  type CreateScenarioRequest,
} from '../api/scenarios'
import { toInt, type ItemRow } from '../components/delivery/deliveryShared'

/** 시나리오를 저장할 때 필요한 현재 입력값. */
export interface DraftInput {
  binW: number
  binH: number
  margin: number
  allowRotate: boolean
  preserveOrder: boolean
  items: ItemRow[]
}

/**
 * 적재 시나리오(저장·불러오기·즐겨찾기·삭제)와 그 모달 상태.
 *
 * 이 화면의 본체는 적재 계산인데, 시나리오 관리만 거기에 딸려 있었다. 열 개 상태를
 * 그대로 둔 채 계산 로직을 읽으려면 두 가지 관심사가 섞여 들어간다. 여기서는 시나리오
 * 쪽만 모은다.
 *
 * 다만 시나리오는 "현재 입력"을 읽어 저장하고, "받은 값"을 화면에 되돌려 넣는다.
 * 그래서 화면이 두 가지를 넘겨 준다 — 지금 입력값을 주는 함수(getInput)와, 시나리오를
 * 불러오는 함수(applyScenario). 어느 쪽도 이 훅 안에서는 모른다.
 */
export function useScenarios(opts: {
  /** 저장·삭제 시 스냅샷을 찍을 현재 입력값 */
  getInput: () => DraftInput
  /** 시나리오를 화면에 되돌릴 때 쓰는 함수 */
  applyScenario: (s: PackingScenario) => void
  onError: (m: string) => void
}) {
  const [scenarios, setScenarios] = useState<PackingScenario[]>([])
  const [favoriteScenarios, setFavoriteScenarios] = useState<PackingScenario[]>([])
  const [showScenarioModal, setShowScenarioModal] = useState(false)
  const [showLoadModal, setShowLoadModal] = useState(false)
  const [scenarioQuery, setScenarioQuery] = useState('')
  const [scenarioName, setScenarioName] = useState('')
  const [scenarioDescription, setScenarioDescription] = useState('')
  const [editingScenario, setEditingScenario] = useState<PackingScenario | null>(null)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PackingScenario | null>(null)

  const loadScenarios = useCallback(async () => {
    try {
      const [all, favorites] = await Promise.all([getAllScenarios(), getFavoriteScenarios()])
      setScenarios(all)
      setFavoriteScenarios(favorites)
    } catch (e: any) {
      opts.onError(e?.message || '시나리오 목록을 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    void loadScenarios()
  }, [loadScenarios])

  async function saveScenario(e: FormEvent) {
    e.preventDefault()
    if (!scenarioName.trim()) {
      setFormError('시나리오 이름을 입력해주세요.')
      return
    }

    const input = opts.getInput()

    // 가로·세로·수량이 모두 0보다 큰 물품만 저장한다. 이름이 비면 순번으로 채운다.
    const validItems = input.items
      .filter((item) => toInt(item.w) > 0 && toInt(item.h) > 0 && toInt(item.qty) > 0)
      .map((item, index) => ({
        name: item.name.trim() || `물품${index + 1}`,
        width: toInt(item.w),
        height: toInt(item.h),
        quantity: toInt(item.qty),
      }))

    if (validItems.length === 0) {
      setFormError('저장할 물품이 없습니다. 가로·세로·수량이 모두 0보다 큰 물품을 추가해주세요.')
      return
    }

    const request: CreateScenarioRequest = {
      name: scenarioName.trim(),
      description: scenarioDescription.trim() || undefined,
      truckWidth: input.binW,
      truckHeight: input.binH,
      allowRotate: input.allowRotate,
      margin: input.margin,
      preserveOrder: input.preserveOrder,
      items: validItems,
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingScenario) {
        await updateScenario(editingScenario.id!, request)
      } else {
        await createScenario(request)
      }
      closeScenarioModal()
      opts.onError('')
      await loadScenarios()
    } catch (e: any) {
      // 서버는 이름이 겹칠 때 400을 준다
      if (e?.message?.includes('400')) {
        setFormError('이미 같은 이름의 시나리오가 있습니다. 다른 이름을 사용해주세요.')
      } else {
        setFormError(e?.message || '시나리오 저장에 실패했습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  function loadScenario(scenario: PackingScenario) {
    opts.applyScenario(scenario)
    setShowLoadModal(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteScenario(deleteTarget.id!)
      opts.onError('')
      await loadScenarios()
    } catch (e: any) {
      opts.onError(e?.message || '시나리오 삭제에 실패했습니다.')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function toggleFavoriteHandler(id: number) {
    try {
      await toggleFavorite(id)
      opts.onError('')
      await loadScenarios()
    } catch (e: any) {
      opts.onError(e?.message || '즐겨찾기 설정에 실패했습니다.')
    }
  }

  function openSaveModal() {
    setEditingScenario(null)
    setScenarioName('')
    setScenarioDescription('')
    setFormError('')
    setShowScenarioModal(true)
  }

  function openEditModal(scenario: PackingScenario) {
    setEditingScenario(scenario)
    setScenarioName(scenario.name)
    setScenarioDescription(scenario.description || '')
    setFormError('')
    setShowLoadModal(false)
    setShowScenarioModal(true)
  }

  function closeScenarioModal() {
    setShowScenarioModal(false)
    setEditingScenario(null)
    setScenarioName('')
    setScenarioDescription('')
    setFormError('')
  }

  return {
    scenarios,
    favoriteScenarios,
    showScenarioModal,
    setShowScenarioModal,
    showLoadModal,
    setShowLoadModal,
    scenarioQuery,
    setScenarioQuery,
    scenarioName,
    setScenarioName,
    scenarioDescription,
    setScenarioDescription,
    editingScenario,
    setEditingScenario,
    formError,
    setFormError,
    saving,
    setSaving,
    deleteTarget,
    setDeleteTarget,
    loadScenarios,
    saveScenario,
    loadScenario,
    confirmDelete,
    toggleFavoriteHandler,
    openSaveModal,
    openEditModal,
    closeScenarioModal,
  }
}