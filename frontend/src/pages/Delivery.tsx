import { useMemo, useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { packIntoTrucks, MAX_PIECES, type PackResult, type Placed } from '../utils/packing'
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
import '../styles/delivery.css'

type ItemRow = { id: number; name: string; w: string; h: string; qty: string }

/**
 * 물품 구분색. 테마 토큰을 쓰지 않는 유일한 색으로, 라이트/다크에서 같은 색이어야
 * 같은 물품을 같은 색으로 알아볼 수 있다.
 */
const colorPalette = [
  { fill: '#3b82f6', stroke: '#1d4ed8', text: '#ffffff' },
  { fill: '#10b981', stroke: '#047857', text: '#ffffff' },
  { fill: '#f59e0b', stroke: '#b45309', text: '#ffffff' },
  { fill: '#ef4444', stroke: '#b91c1c', text: '#ffffff' },
  { fill: '#8b5cf6', stroke: '#6d28d9', text: '#ffffff' },
  { fill: '#06b6d4', stroke: '#0e7490', text: '#ffffff' },
  { fill: '#84cc16', stroke: '#4d7c0f', text: '#ffffff' },
  { fill: '#f97316', stroke: '#c2410c', text: '#ffffff' },
  { fill: '#ec4899', stroke: '#be185d', text: '#ffffff' },
  { fill: '#64748b', stroke: '#334155', text: '#ffffff' },
]

const getItemColor = (id: number) => colorPalette[id % colorPalette.length]

/**
 * 적재함 프리셋 (차량 적재함 내측 치수).
 *
 * 5톤 장축은 현장에서 쓰는 실제 값을 받은 것이고, 나머지 세 개는 차종·제조사·
 * 바디 종류마다 달라 대표값을 넣어둔 것이다. (확인 필요)
 */
const BIN_PRESETS = [
  { label: '1톤 카고', w: 2830, h: 1630 },
  { label: '2.5톤 카고', w: 4300, h: 1850 },
  { label: '5톤 카고', w: 6200, h: 2300 },
  { label: '5톤 장축', w: 7400, h: 2200 },
]

/** 한 번에 그리는 트럭 수. 결과가 수백 대여도 화면이 버티게 한다. */
const TRUCK_PAGE = 20

const DRAFT_KEY = 'delivery_draft_v1'

/** 적재함 그림이 넘지 않을 크기 (px). 세로로 쌓으니 한 대가 화면을 다 먹으면 안 된다. */
const FIGURE_MAX_W = 900
const FIGURE_MAX_H = 560

/** 적재율 구간 → CSS 톤 클래스 (숫자와 막대가 같은 색을 쓰도록) */
function rateTone(util: number): string {
  if (util >= 80) return 'dl-tone-good'
  if (util >= 50) return 'dl-tone-mid'
  return 'dl-tone-low'
}

function normalizeNumericInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  if (digits === '') return ''
  return String(parseInt(digits, 10)) // 선행 0 제거
}

function toInt(value: string): number {
  const n = parseInt(value || '0', 10)
  return Number.isNaN(n) ? 0 : n
}

/** mm² → m². 적재함은 mm 단위로 입력받지만 면적은 m²로 읽는 게 자연스럽다. */
function toSquareMeters(mm2: number): string {
  return (mm2 / 1_000_000).toFixed(2)
}

/**
 * 적재함 비율에 맞춘 그림 폭.
 * 세로로 긴 적재함은 폭을 줄여야 높이가 FIGURE_MAX_H 안에 들어온다.
 */
function figureWidth(binW: number, binH: number): string {
  if (binW <= 0 || binH <= 0) return '100%'
  const widthAtMaxHeight = Math.round((FIGURE_MAX_H * binW) / binH)
  return `min(100%, ${Math.min(FIGURE_MAX_W, widthAtMaxHeight)}px)`
}

// ── 임시저장 ─────────────────────────────────────────────────

interface Draft {
  binW: string
  binH: string
  margin: string
  allowRotate: boolean
  preserveOrder: boolean
  items: ItemRow[]
}

/** 새로고침으로 입력이 날아가지 않게 브라우저에 남겨둔 초안 */
function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const draft = JSON.parse(raw) as Draft
    // 저장 형식이 바뀌었거나 손상된 값은 조용히 버린다
    if (!Array.isArray(draft.items)) return null
    return draft
  } catch {
    return null
  }
}

export default function DeliveryPage() {
  const [initialDraft] = useState<Draft | null>(loadDraft)

  const [binWStr, setBinWStr] = useState<string>(initialDraft?.binW ?? '1200')
  const [binHStr, setBinHStr] = useState<string>(initialDraft?.binH ?? '800')
  const [marginStr, setMarginStr] = useState<string>(initialDraft?.margin ?? '0')
  const [allowRotate, setAllowRotate] = useState<boolean>(initialDraft?.allowRotate ?? true)
  const [preserveOrder, setPreserveOrder] = useState<boolean>(initialDraft?.preserveOrder ?? false)
  const [items, setItems] = useState<ItemRow[]>(initialDraft?.items ?? [])

  const [error, setError] = useState<string>('')
  const [showRestoredHint, setShowRestoredHint] = useState<boolean>(!!initialDraft)

  // 시나리오 관련 상태
  const [scenarios, setScenarios] = useState<PackingScenario[]>([])
  const [favoriteScenarios, setFavoriteScenarios] = useState<PackingScenario[]>([])
  const [showScenarioModal, setShowScenarioModal] = useState<boolean>(false)
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false)
  const [scenarioQuery, setScenarioQuery] = useState<string>('')
  const [scenarioName, setScenarioName] = useState<string>('')
  const [scenarioDescription, setScenarioDescription] = useState<string>('')
  const [editingScenario, setEditingScenario] = useState<PackingScenario | null>(null)
  const [formError, setFormError] = useState<string>('')
  const [saving, setSaving] = useState<boolean>(false)
  const [deleteTarget, setDeleteTarget] = useState<PackingScenario | null>(null)

  const nameMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.name])), [items])

  // 계산 상태 및 결과
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [result, setResult] = useState<PackResult | null>(null)
  const [collapsedTrucks, setCollapsedTrucks] = useState<Set<number>>(new Set())
  const [visibleTrucks, setVisibleTrucks] = useState<number>(TRUCK_PAGE)

  // 방금 지운 행 (되돌리기용)
  const [lastRemoved, setLastRemoved] = useState<{ index: number; row: ItemRow } | null>(null)

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 행을 추가한 직후 그 행의 이름 칸으로 포커스를 옮기기 위한 표시
  const focusItemIdRef = useRef<number | null>(null)

  const binW = toInt(binWStr)
  const binH = toInt(binHStr)
  const margin = toInt(marginStr)

  // 디바운스된 계산 함수
  const debouncedCalculation = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const w = toInt(binWStr)
      const h = toInt(binHStr)
      const m = toInt(marginStr)
      const rects = items.map((i) => ({ id: i.id, w: toInt(i.w), h: toInt(i.h), qty: toInt(i.qty) }))

      if (rects.length === 0 || w <= 0 || h <= 0) {
        setResult(null)
        setIsCalculating(false)
        return
      }

      setIsCalculating(true)

      // 계산 자체는 동기라 한 틱 미뤄야 "계산 중" 표시가 실제로 그려진다
      setTimeout(() => {
        try {
          setResult(packIntoTrucks(rects, w, h, { allowRotate, margin: m, preserveOrder }))
        } catch (e: any) {
          console.error('Packing calculation error:', e)
          setResult(null)
        } finally {
          setIsCalculating(false)
        }
      }, 0)
    }, 300) // 300ms 디바운스
  }, [binWStr, binHStr, marginStr, items, allowRotate, preserveOrder])

  // 입력 변경 시 디바운스 계산 트리거
  useEffect(() => {
    debouncedCalculation()
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [debouncedCalculation])

  // 결과가 새로 나오면 다시 앞에서부터 보여준다
  useEffect(() => {
    setVisibleTrucks(TRUCK_PAGE)
  }, [result])

  // 입력을 브라우저에 남겨 새로고침해도 이어서 쓸 수 있게 한다
  useEffect(() => {
    const timer = setTimeout(() => {
      const draft: Draft = { binW: binWStr, binH: binHStr, margin: marginStr, allowRotate, preserveOrder, items }
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      } catch {
        // 용량 초과 등은 무시한다. 임시저장은 실패해도 화면은 그대로 동작해야 한다.
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [binWStr, binHStr, marginStr, allowRotate, preserveOrder, items])

  // 복원 안내는 잠깐만 띄운다 (계속 남아 있으면 그냥 잡음이다)
  useEffect(() => {
    if (!showRestoredHint) return
    const timer = setTimeout(() => setShowRestoredHint(false), 8000)
    return () => clearTimeout(timer)
  }, [showRestoredHint])

  // ── 물품 목록 ──────────────────────────────────────────────

  const nextItemId = () => (items.length ? Math.max(...items.map((i) => i.id)) + 1 : 1)

  function addItem() {
    const id = nextItemId()
    focusItemIdRef.current = id
    setItems([...items, { id, name: '', w: '200', h: '200', qty: '1' }])
    setLastRemoved(null)
  }

  function duplicateItem(idx: number) {
    const src = items[idx]
    const id = nextItemId()
    focusItemIdRef.current = id
    const next = [...items]
    next.splice(idx + 1, 0, { ...src, id, name: src.name ? `${src.name} 사본` : '' })
    setItems(next)
    setLastRemoved(null)
  }

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    setItems(next)
  }

  function removeItem(idx: number) {
    setLastRemoved({ index: idx, row: items[idx] })
    const next = [...items]
    next.splice(idx, 1)
    setItems(next)
  }

  function undoRemove() {
    if (!lastRemoved) return
    const next = [...items]
    next.splice(Math.min(lastRemoved.index, next.length), 0, lastRemoved.row)
    setItems(next)
    setLastRemoved(null)
  }

  function resetInputs() {
    if (!window.confirm('입력한 적재함 설정과 물품 목록을 모두 지울까요?')) return
    setBinWStr('1200')
    setBinHStr('800')
    setMarginStr('0')
    setAllowRotate(true)
    setPreserveOrder(false)
    setItems([])
    setLastRemoved(null)
    setShowRestoredHint(false)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // 지우기 실패는 무시. 다음 편집 때 어차피 덮어쓴다.
    }
  }

  // ── 드래그 정렬 ────────────────────────────────────────────

  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== idx) {
      setDragOverIndex(idx)
    }
  }

  function handleDrop(idx: number) {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const next = [...items]
    const [dragged] = next.splice(dragIndex, 1)
    next.splice(idx, 0, dragged)
    setItems(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // ── 시나리오 ───────────────────────────────────────────────

  const loadScenarios = useCallback(async () => {
    try {
      const [allScenarios, favorites] = await Promise.all([getAllScenarios(), getFavoriteScenarios()])
      setScenarios(allScenarios)
      setFavoriteScenarios(favorites)
    } catch (e: any) {
      setError(e?.message || '시나리오 목록을 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    loadScenarios()
  }, [loadScenarios])

  async function saveScenario(e: FormEvent) {
    e.preventDefault()
    if (!scenarioName.trim()) {
      setFormError('시나리오 이름을 입력해주세요.')
      return
    }

    // 가로·세로·수량이 모두 0보다 큰 물품만 저장한다. 이름이 비면 순번으로 채운다.
    const validItems = items
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
      truckWidth: binW,
      truckHeight: binH,
      allowRotate,
      margin,
      preserveOrder,
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
      setError('')
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
    setBinWStr(String(scenario.truckWidth))
    setBinHStr(String(scenario.truckHeight))
    setAllowRotate(scenario.allowRotate)
    setMarginStr(String(scenario.margin))
    setPreserveOrder(!!scenario.preserveOrder)
    // 서버가 sortOrder 순으로 내려주므로 받은 순서 그대로 쓴다
    setItems(
      scenario.items.map((item, index) => ({
        id: index + 1,
        name: item.name,
        w: String(item.width),
        h: String(item.height),
        qty: String(item.quantity),
      })),
    )
    setLastRemoved(null)
    setShowRestoredHint(false)
    setShowLoadModal(false)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      await deleteScenario(deleteTarget.id!)
      setError('')
      await loadScenarios()
    } catch (e: any) {
      setError(e?.message || '시나리오 삭제에 실패했습니다.')
    } finally {
      setDeleteTarget(null)
    }
  }

  async function toggleFavoriteHandler(id: number) {
    try {
      await toggleFavorite(id)
      setError('')
      await loadScenarios()
    } catch (e: any) {
      setError(e?.message || '즐겨찾기 설정에 실패했습니다.')
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

  const anyModalOpen = showScenarioModal || showLoadModal || deleteTarget !== null

  // 모달이 열려 있는 동안 Esc로 닫고, 뒤 배경이 스크롤되지 않게 한다
  useEffect(() => {
    if (!anyModalOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      // 겹쳐 뜬 모달은 위에 있는 것부터 닫는다
      if (deleteTarget !== null) setDeleteTarget(null)
      else if (showScenarioModal) closeScenarioModal()
      else setShowLoadModal(false)
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [anyModalOpen, deleteTarget, showScenarioModal])

  const filteredScenarios = useMemo(() => {
    const q = scenarioQuery.trim().toLowerCase()
    if (!q) return scenarios
    return scenarios.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q),
    )
  }, [scenarios, scenarioQuery])

  // ── 트럭 접기 ──────────────────────────────────────────────

  function toggleTruck(index: number) {
    setCollapsedTrucks((prev) => {
      const next = new Set(prev)
      if (!next.delete(index)) next.add(index)
      return next
    })
  }

  // 트럭 수가 줄면 사라진 번호의 접힘 상태를 버린다.
  // 안 그러면 나중에 다시 그 번호가 생겼을 때 이유 없이 접힌 채로 나온다.
  const truckCount = result?.count ?? 0
  useEffect(() => {
    setCollapsedTrucks((prev) => {
      const next = new Set([...prev].filter((i) => i < truckCount))
      return next.size === prev.size ? prev : next
    })
  }, [truckCount])

  function handlePrint() {
    // 인쇄물에는 "더 보기"로 안 펼친 트럭까지 다 나와야 한다
    if (result) setVisibleTrucks(result.count)
    // React가 그려낸 뒤에 인쇄창을 띄운다
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  // ── 요약 ───────────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalQty = items.reduce((sum, i) => sum + toInt(i.qty), 0)
    const usedArea = result
      ? result.trucks.reduce((sum, t) => sum + t.reduce((s, it) => s + it.w * it.h, 0), 0)
      : 0
    const totalArea = result ? result.count * binW * binH : 0
    const binArea = binW * binH
    // 면적만 따진 하한. 실제로는 모양 때문에 이보다 적게 실린다.
    const idealCount = binArea > 0 && usedArea > 0 ? Math.ceil(usedArea / binArea) : 0
    return {
      truckCount: result?.count ?? 0,
      utilization: totalArea > 0 ? Math.round((usedArea / totalArea) * 100) : 0,
      kinds: items.length,
      totalQty,
      usedArea,
      totalArea,
      idealCount,
    }
  }, [result, items, binW, binH])

  const unplaceableIds = useMemo(
    () => new Set(result?.unplaceable ?? []),
    [result],
  )

  const hasItems = items.length > 0
  const aborted = result?.aborted ?? false
  const showResult = !!result && !aborted && result.count > 0

  return (
    <div className="fl-page dl-page">
      <div className="fl-titleband">
        <div>
          <h1>적재 시뮬레이터</h1>
          <p>적재함과 물품 크기를 입력하면 필요한 트럭 수와 배치가 바로 계산됩니다.</p>
        </div>
        <div className="dl-titleband-actions">
          <button className="fl-btn" onClick={handlePrint} disabled={!showResult}>
            인쇄
          </button>
          <button className="fl-btn" onClick={() => setShowLoadModal(true)}>
            불러오기
          </button>
          <button className="fl-btn fl-btn-primary" onClick={openSaveModal}>
            시나리오 저장
          </button>
        </div>
      </div>

      {error && <div className="fl-error">{error}</div>}

      <div className="fl-stat-grid">
        <div className="fl-stat">
          <div className="fl-stat-label">필요 트럭</div>
          <div className="fl-stat-value">
            <span className="fl-stat-num">{stats.truckCount}</span>
            <span className="fl-stat-unit">대</span>
          </div>
          <div className="fl-stat-sub">
            {stats.idealCount > 0
              ? `면적만 따진 하한 ${stats.idealCount}대`
              : `적재함 ${binW || '—'} × ${binH || '—'} mm`}
          </div>
        </div>

        <div className="fl-stat">
          <div className="fl-stat-label">전체 적재율</div>
          <div className="fl-stat-value">
            <span className={`fl-stat-num${showResult && stats.utilization < 50 ? ' fl-tone-warn' : ''}`}>
              {stats.utilization}
            </span>
            <span className="fl-stat-unit">%</span>
          </div>
          <div className="fl-stat-sub">
            회전 {allowRotate ? '허용' : '미허용'} · 마진 {margin}mm
          </div>
        </div>

        <div className="fl-stat">
          <div className="fl-stat-label">물품 종류</div>
          <div className="fl-stat-value">
            <span className="fl-stat-num">{stats.kinds}</span>
            <span className="fl-stat-unit">종</span>
          </div>
          <div className="fl-stat-sub">총 {stats.totalQty}개</div>
        </div>

        <div className="fl-stat">
          <div className="fl-stat-label">적재 면적</div>
          <div className="fl-stat-value">
            <span className="fl-stat-num">{toSquareMeters(stats.usedArea)}</span>
            <span className="fl-stat-unit">m²</span>
          </div>
          <div className="fl-stat-sub">트럭 전체 {toSquareMeters(stats.totalArea)} m²</div>
        </div>
      </div>

      <section className="fl-card">
        <div className="fl-card-head">
          <span className="fl-card-title">적재함 설정</span>
          <div className="dl-head-actions">
            <span className="fl-card-count">단위 mm</span>
            <button className="fl-btn fl-btn-sm" onClick={resetInputs}>
              초기화
            </button>
          </div>
        </div>
        <div className="fl-card-body">
          <div className="dl-presets">
            {BIN_PRESETS.map((preset) => {
              const isOn = preset.w === binW && preset.h === binH
              return (
                <button
                  key={preset.label}
                  className={`dl-preset${isOn ? ' is-on' : ''}`}
                  onClick={() => {
                    setBinWStr(String(preset.w))
                    setBinHStr(String(preset.h))
                  }}
                >
                  {preset.label}
                  <span className="dl-preset-dim">{preset.w}×{preset.h}</span>
                </button>
              )
            })}
          </div>

          <div className="dl-bin-row">
            <label className="fl-field dl-bin-field">
              <span className="fl-field-label">가로</span>
              <input
                className="fl-input"
                inputMode="numeric"
                value={binWStr}
                onChange={(e) => setBinWStr(normalizeNumericInput(e.target.value))}
                placeholder="1200"
              />
            </label>
            <label className="fl-field dl-bin-field">
              <span className="fl-field-label">세로</span>
              <input
                className="fl-input"
                inputMode="numeric"
                value={binHStr}
                onChange={(e) => setBinHStr(normalizeNumericInput(e.target.value))}
                placeholder="800"
              />
            </label>
            <label className="fl-field dl-bin-field">
              <span className="fl-field-label">
                마진 <span className="fl-optional">(물품 간격)</span>
              </span>
              <input
                className="fl-input"
                inputMode="numeric"
                value={marginStr}
                onChange={(e) => setMarginStr(normalizeNumericInput(e.target.value))}
                placeholder="0"
              />
            </label>
            <label className={`dl-toggle${allowRotate ? ' is-on' : ''}`}>
              <input
                type="checkbox"
                checked={allowRotate}
                onChange={(e) => setAllowRotate(e.target.checked)}
              />
              회전 허용
            </label>
          </div>

          <div className="dl-sort-row">
            <span className="fl-field-label">적재 순서</span>
            <div className="fl-seg">
              <button
                className={`fl-seg-btn${preserveOrder ? '' : ' is-active'}`}
                onClick={() => setPreserveOrder(false)}
              >
                자동 최적
              </button>
              <button
                className={`fl-seg-btn${preserveOrder ? ' is-active' : ''}`}
                onClick={() => setPreserveOrder(true)}
              >
                입력 순서
              </button>
            </div>
          </div>

          <div className="fl-hint">
            {preserveOrder
              ? '물품 목록에 적은 순서대로 먼저 싣습니다. 표에서 행을 끌어 순서를 바꿀 수 있습니다.'
              : '큰 물품부터 실어 트럭 수를 줄입니다. 이 모드에서는 물품 목록의 순서가 결과에 반영되지 않습니다.'}
            {allowRotate ? ' 회전을 허용하면 물품을 90° 돌려 넣어 트럭 수를 더 줄일 수 있습니다.' : ''}
          </div>

          {showRestoredHint && (
            <div className="fl-hint">이전에 입력하던 내용을 불러왔습니다. 처음부터 하려면 ‘초기화’를 누르세요.</div>
          )}
        </div>
      </section>

      <section className="fl-card dl-card-gap">
        <div className="fl-card-head">
          <div className="dl-head-actions">
            <span className="fl-card-title">물품 목록</span>
            <span className="fl-card-count">{items.length}종 · 총 {stats.totalQty}개</span>
          </div>
          <div className="dl-head-actions">
            {lastRemoved && (
              <button className="fl-btn fl-btn-sm" onClick={undoRemove}>
                삭제 되돌리기
              </button>
            )}
            <button className="fl-btn fl-btn-primary fl-btn-sm" onClick={addItem}>
              물품 추가
            </button>
          </div>
        </div>

        <div className="fl-card-body fl-flush">
          <div className="fl-th dl-item-head">
            <div>순서</div>
            <div>이름</div>
            <div style={{ textAlign: 'center' }}>치수 (mm)</div>
            <div style={{ textAlign: 'center' }}>수량</div>
            <div />
          </div>

          {items.length === 0 ? (
            <div className="fl-empty">
              등록된 물품이 없습니다. ‘물품 추가’로 적재할 물품을 넣어보세요.
            </div>
          ) : (
            items.map((it, idx) => {
              const tooBig = unplaceableIds.has(it.id)
              return (
                <div
                  key={it.id}
                  className={[
                    'fl-tr',
                    'dl-item-row',
                    dragIndex === idx ? 'is-dragging' : '',
                    dragOverIndex === idx ? 'is-over' : '',
                    tooBig ? 'is-invalid' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  draggable
                  onDragStart={() => setDragIndex(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={() => setDragOverIndex(null)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={handleDragEnd}
                >
                  <span className={`dl-item-order${preserveOrder ? '' : ' is-muted'}`}>
                    <span
                      className="fl-drag-handle"
                      aria-hidden="true"
                      title={preserveOrder ? '끌어서 순서 변경' : '자동 최적 모드에서는 순서가 결과에 반영되지 않습니다'}
                    >
                      ⠿
                    </span>
                    {idx + 1}
                  </span>
                  <input
                    className="fl-input dl-item-name"
                    value={it.name}
                    ref={(el) => {
                      if (el && focusItemIdRef.current === it.id) {
                        el.focus()
                        focusItemIdRef.current = null
                      }
                    }}
                    onChange={(e) => updateItem(idx, { name: e.target.value })}
                    placeholder={`물품${idx + 1}`}
                    aria-label={`${idx + 1}번 물품 이름`}
                  />
                  <span className="dl-dims">
                    <input
                      className="fl-input"
                      inputMode="numeric"
                      value={it.w}
                      onChange={(e) => updateItem(idx, { w: normalizeNumericInput(e.target.value) })}
                      placeholder="400"
                      aria-label={`${idx + 1}번 물품 가로`}
                    />
                    <span className="dl-dims-x">✕</span>
                    <input
                      className="fl-input"
                      inputMode="numeric"
                      value={it.h}
                      onChange={(e) => updateItem(idx, { h: normalizeNumericInput(e.target.value) })}
                      placeholder="300"
                      aria-label={`${idx + 1}번 물품 세로`}
                    />
                    {/* 표 머리가 사라지는 좁은 화면에서만 보이는 단위 */}
                    <span className="dl-cell-label dl-cell-unit" aria-hidden="true">
                      mm
                    </span>
                  </span>
                  <span className="dl-qty">
                    <span className="dl-cell-label" aria-hidden="true">
                      수량
                    </span>
                    <input
                      className="fl-input dl-item-qty"
                      inputMode="numeric"
                      value={it.qty}
                      onChange={(e) => updateItem(idx, { qty: normalizeNumericInput(e.target.value) })}
                      onKeyDown={(e) => {
                        // 마지막 행에서 Enter를 치면 이어서 다음 행을 넣는다
                        if (e.key === 'Enter' && idx === items.length - 1) {
                          e.preventDefault()
                          addItem()
                        }
                      }}
                      aria-label={`${idx + 1}번 물품 수량`}
                    />
                  </span>
                  <span className="fl-cell-actions dl-item-actions">
                    <button
                      className="fl-btn-e"
                      onClick={() => duplicateItem(idx)}
                      title="복제"
                      aria-label="복제"
                    >
                      ⧉
                    </button>
                    <button
                      className="fl-btn-x"
                      onClick={() => removeItem(idx)}
                      title="삭제"
                      aria-label="삭제"
                    >
                      ×
                    </button>
                  </span>
                  {tooBig && (
                    <span className="dl-item-note">
                      적재함({binW}×{binH}mm)보다 커서 이 물품은 제외했습니다.
                    </span>
                  )}
                </div>
              )
            })
          )}
        </div>
      </section>

      <section className="fl-card dl-card-gap dl-preview-card">
        <div className="fl-card-head">
          <span className="fl-card-title">적재 미리보기</span>
          <span className="fl-card-count">
            {isCalculating
              ? '계산 중...'
              : showResult
                ? `트럭 ${result!.count}대 · 전체 적재율 ${stats.utilization}%`
                : '결과 없음'}
          </span>
        </div>

        {!showResult ? (
          <div className="fl-card-body">
            {aborted ? (
              <div className="fl-error">
                물품이 너무 많아 계산하지 않았습니다. (요청 {result!.pieceCount.toLocaleString()}개 / 최대{' '}
                {MAX_PIECES.toLocaleString()}개) 수량을 줄이거나 나눠서 확인해주세요.
              </div>
            ) : unplaceableIds.size > 0 ? (
              <div className="fl-error">
                모든 물품이 적재함보다 큽니다. 적재함 크기나 물품 치수를 확인해주세요.
              </div>
            ) : (
              <div className="fl-empty">
                {!hasItems
                  ? '물품을 추가하면 적재 배치가 여기에 그려집니다.'
                  : binW <= 0 || binH <= 0
                    ? '적재함 가로·세로를 입력해주세요.'
                    : '치수와 수량을 입력하면 적재 배치가 그려집니다.'}
              </div>
            )}
          </div>
        ) : (
          <div className="fl-card-body dl-preview-body">
            {unplaceableIds.size > 0 && (
              <div className="fl-error">
                {unplaceableIds.size}종은 적재함보다 커서 제외했습니다. 물품 목록에서 표시된 행을 확인해주세요.
              </div>
            )}

            <div className="dl-truck-grid">
              {result!.trucks.slice(0, visibleTrucks).map((truck, tIdx) => (
                <TruckCard
                  key={tIdx}
                  index={tIdx}
                  truck={truck}
                  binW={binW}
                  binH={binH}
                  nameMap={nameMap}
                  collapsed={collapsedTrucks.has(tIdx)}
                  onToggle={() => toggleTruck(tIdx)}
                />
              ))}
            </div>

            {result!.count > visibleTrucks && (
              <div className="dl-more">
                <button
                  className="fl-btn"
                  onClick={() => setVisibleTrucks((n) => n + TRUCK_PAGE)}
                >
                  트럭 {Math.min(TRUCK_PAGE, result!.count - visibleTrucks)}대 더 보기 (남은{' '}
                  {result!.count - visibleTrucks}대)
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* 시나리오 저장 / 수정 모달 */}
      {showScenarioModal && (
        <div
          className="fl-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeScenarioModal()
          }}
        >
          <form className="fl-modal" onSubmit={saveScenario} role="dialog" aria-modal="true">
            <div className="fl-modal-head">
              <div className="fl-modal-heading">
                <span className="fl-modal-title">
                  {editingScenario ? '시나리오 수정' : '시나리오 저장'}
                </span>
                <span className="fl-modal-sub">
                  지금 화면의 적재함 설정과 물품 목록이 함께 저장됩니다.
                </span>
              </div>
              <button
                type="button"
                className="fl-modal-close"
                onClick={closeScenarioModal}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="fl-modal-body">
              <label className="fl-field">
                <span className="fl-field-label">시나리오 이름</span>
                <input
                  className="fl-input"
                  value={scenarioName}
                  onChange={(e) => {
                    setScenarioName(e.target.value)
                    if (formError) setFormError('')
                  }}
                  placeholder="예: 기본 적재 설정"
                  autoFocus
                />
              </label>

              <label className="fl-field">
                <span className="fl-field-label">
                  설명 <span className="fl-optional">(선택)</span>
                </span>
                <textarea
                  className="fl-input fl-textarea"
                  value={scenarioDescription}
                  onChange={(e) => setScenarioDescription(e.target.value)}
                  placeholder="어떤 상황에 쓰는 설정인지 간단히 적어주세요"
                />
              </label>

              <div className="fl-hint">
                적재함 {binW} × {binH} mm · 마진 {margin}mm · 회전 {allowRotate ? '허용' : '미허용'} ·
                적재 순서 {preserveOrder ? '입력 순서' : '자동 최적'} · 물품 {items.length}종
              </div>

              {formError && <div className="fl-error">{formError}</div>}
            </div>

            <div className="fl-modal-foot">
              <span className="fl-modal-foot-note">이름은 시나리오마다 달라야 합니다.</span>
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn" onClick={closeScenarioModal}>
                  취소
                </button>
                <button type="submit" className="fl-btn fl-btn-primary" disabled={saving}>
                  {saving ? '저장 중...' : editingScenario ? '수정 저장' : '저장'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 시나리오 불러오기 모달 */}
      {showLoadModal && (
        <div
          className="fl-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowLoadModal(false)
          }}
        >
          <div className="fl-modal dl-modal-wide" role="dialog" aria-modal="true">
            <div className="fl-modal-head">
              <div className="fl-modal-heading">
                <span className="fl-modal-title">시나리오 불러오기</span>
                <span className="fl-modal-sub">
                  저장한 설정을 불러오면 지금 입력한 내용은 덮어씌워집니다.
                </span>
              </div>
              <button
                type="button"
                className="fl-modal-close"
                onClick={() => setShowLoadModal(false)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="dl-scenario-search">
              <input
                className="fl-input"
                value={scenarioQuery}
                onChange={(e) => setScenarioQuery(e.target.value)}
                placeholder="이름이나 설명으로 검색"
                aria-label="시나리오 검색"
                autoFocus
              />
            </div>

            <div className="fl-modal-body dl-scenario-body">
              {favoriteScenarios.length > 0 && !scenarioQuery.trim() && (
                <div className="dl-scenario-group">
                  <div className="dl-scenario-label">즐겨찾기</div>
                  <div className="dl-scenario-list">
                    {favoriteScenarios.map((scenario) => (
                      <ScenarioRow
                        key={scenario.id}
                        scenario={scenario}
                        onLoad={() => loadScenario(scenario)}
                        onEdit={() => openEditModal(scenario)}
                        onDelete={() => setDeleteTarget(scenario)}
                        onToggleFavorite={() => toggleFavoriteHandler(scenario.id!)}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="dl-scenario-group">
                <div className="dl-scenario-label">
                  {scenarioQuery.trim() ? `검색 결과 ${filteredScenarios.length}개` : '전체 시나리오'}
                </div>
                {filteredScenarios.length === 0 ? (
                  <div className="fl-empty">
                    {scenarioQuery.trim() ? '검색과 맞는 시나리오가 없습니다.' : '저장된 시나리오가 없습니다.'}
                  </div>
                ) : (
                  <div className="dl-scenario-list">
                    {filteredScenarios.map((scenario) => (
                      <ScenarioRow
                        key={scenario.id}
                        scenario={scenario}
                        onLoad={() => loadScenario(scenario)}
                        onEdit={() => openEditModal(scenario)}
                        onDelete={() => setDeleteTarget(scenario)}
                        onToggleFavorite={() => toggleFavoriteHandler(scenario.id!)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="fl-modal-foot">
              <span className="fl-modal-foot-note">총 {scenarios.length}개</span>
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn" onClick={() => setShowLoadModal(false)}>
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTarget && (
        <div
          className="fl-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteTarget(null)
          }}
        >
          <div className="fl-modal dl-modal-narrow" role="dialog" aria-modal="true">
            <div className="fl-modal-head">
              <div className="fl-modal-heading">
                <span className="fl-modal-title">시나리오 삭제</span>
              </div>
              <button
                type="button"
                className="fl-modal-close"
                onClick={() => setDeleteTarget(null)}
                aria-label="닫기"
              >
                ✕
              </button>
            </div>

            <div className="fl-modal-body">
              <p className="dl-confirm-text">
                <span className="dl-confirm-name">{deleteTarget.name}</span> 시나리오를 삭제할까요?
                <br />이 작업은 되돌릴 수 없습니다.
              </p>
            </div>

            <div className="fl-modal-foot">
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn" onClick={() => setDeleteTarget(null)}>
                  취소
                </button>
                <button type="button" className="fl-btn fl-btn-danger-solid" onClick={confirmDelete}>
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 시나리오 한 줄 ───────────────────────────────────────────

function ScenarioRow({
  scenario,
  onLoad,
  onEdit,
  onDelete,
  onToggleFavorite,
}: {
  scenario: PackingScenario
  onLoad: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}) {
  return (
    <div className="dl-scenario">
      <div className="dl-scenario-head">
        <div style={{ minWidth: 0 }}>
          <div className="dl-scenario-name">{scenario.name}</div>
          {scenario.description && <p className="dl-scenario-desc">{scenario.description}</p>}
        </div>
        <button
          className={`dl-star${scenario.isFavorite ? ' is-on' : ''}`}
          onClick={onToggleFavorite}
          title={scenario.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
          aria-label={scenario.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          {scenario.isFavorite ? '★' : '☆'}
        </button>
      </div>

      <div className="dl-scenario-meta">
        <span>
          적재함 {scenario.truckWidth} × {scenario.truckHeight} mm
        </span>
        <span>물품 {scenario.items.length}종</span>
        <span>회전 {scenario.allowRotate ? '허용' : '미허용'}</span>
        <span>마진 {scenario.margin}mm</span>
        {scenario.preserveOrder && <span>입력 순서 적재</span>}
      </div>

      <div className="dl-scenario-actions">
        <button className="fl-btn fl-btn-sm" onClick={onEdit}>
          수정
        </button>
        <button className="fl-btn fl-btn-sm fl-btn-danger" onClick={onDelete}>
          삭제
        </button>
        <button className="fl-btn fl-btn-sm fl-btn-primary" onClick={onLoad}>
          불러오기
        </button>
      </div>
    </div>
  )
}

// ── 트럭 한 대 ───────────────────────────────────────────────

/**
 * 적재도를 PNG로 내려받는다.
 *
 * 캔버스로 옮기면 화면의 CSS가 따라오지 않는다. 격자선이 쓰는 currentColor와
 * 글꼴을 복제본에 직접 박아 넣어야 화면과 같은 그림이 나온다.
 */
function downloadTruckImage(svg: SVGSVGElement, filename: string) {
  const rect = svg.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const scale = 2 // 인쇄·확대에 견디도록 2배로 그린다

  const computed = getComputedStyle(svg)
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(width))
  clone.setAttribute('height', String(height))
  clone.setAttribute('style', `color: ${computed.color}; font-family: ${computed.fontFamily};`)

  const source = new XMLSerializer().serializeToString(clone)
  const svgUrl = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml;charset=utf-8' }))

  const image = new Image()
  image.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = width * scale
    canvas.height = height * scale
    const ctx = canvas.getContext('2d')
    if (ctx) {
      // 종이에 인쇄할 걸 생각하면 배경은 투명보다 흰색이 낫다
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    }
    URL.revokeObjectURL(svgUrl)

    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  }
  image.onerror = () => URL.revokeObjectURL(svgUrl)
  image.src = svgUrl
}

function TruckCard({
  index,
  truck,
  binW,
  binH,
  nameMap,
  collapsed,
  onToggle,
}: {
  index: number
  truck: Placed[]
  binW: number
  binH: number
  nameMap: Record<number, string>
  collapsed: boolean
  onToggle: () => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const truckArea = binW * binH
  const itemArea = truck.reduce((sum, it) => sum + it.w * it.h, 0)
  const utilization = truckArea > 0 ? Math.round((itemArea / truckArea) * 100) : 0
  const tone = rateTone(utilization)

  // 이름별 수량 집계
  const summary = truck.reduce<Record<string, { count: number; id: number }>>((acc, it) => {
    const name = nameMap[it.id] || `물품${it.id}`
    if (!acc[name]) acc[name] = { count: 0, id: it.id }
    acc[name].count++
    return acc
  }, {})

  return (
    <div className={`dl-truck${collapsed ? ' is-collapsed' : ''}`}>
      <div className="dl-truck-head">
        <button
          type="button"
          className="dl-truck-toggle"
          onClick={onToggle}
          aria-expanded={!collapsed}
          title={collapsed ? '펼치기' : '접기'}
        >
          <span className="dl-truck-caret" aria-hidden="true">
            ▼
          </span>
          <span className="dl-truck-name">트럭 {index + 1}</span>
        </button>
        <span className="dl-truck-count">물품 {truck.length}개</span>
        <span className={`dl-truck-rate ${tone}`}>적재율 {utilization}%</span>
        <button
          type="button"
          className="dl-truck-save"
          onClick={() => svgRef.current && downloadTruckImage(svgRef.current, `적재도_트럭${index + 1}.png`)}
          title="이미지로 저장"
          aria-label="이미지로 저장"
        >
          ⤓
        </button>
      </div>

      <div className="dl-bar">
        <div className={`dl-bar-fill ${tone}`} style={{ width: `${utilization}%` }} />
      </div>

      {/*
        접었을 때 지우지 않고 CSS로 숨긴다. 인쇄할 때는 접힌 트럭도 나와야 하는데
        DOM에 없으면 @media print로 되살릴 수가 없다.
      */}
      <div className="dl-truck-figure" style={{ width: figureWidth(binW, binH) }}>
        <TruckSvg ref={svgRef} binW={binW} binH={binH} items={truck} nameMap={nameMap} />

        <div className="dl-chips">
          {Object.entries(summary).map(([name, { count, id }]) => {
            const colors = getItemColor(id)
            return (
              <span key={name} className="dl-chip">
                <i className="dl-chip-dot" style={{ backgroundColor: colors.fill }} />
                <span className="dl-chip-name">{name}</span>
                {count > 1 && <span className="dl-chip-count">×{count}</span>}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TruckSvg({
  ref,
  binW,
  binH,
  items,
  nameMap,
}: {
  ref?: React.Ref<SVGSVGElement>
  binW: number
  binH: number
  items: Placed[]
  nameMap: Record<number, string>
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // SVG는 칸 폭에 맞춰 늘어나므로 글자 크기도 화면 px이 아니라 적재함 좌표계로 잡는다
  const baseFont = Math.min(binW, binH) * 0.035
  const gridStep = Math.max(50, Math.round(Math.min(binW, binH) / 8))
  const gridId = `dl-grid-${binW}x${binH}`

  return (
    <svg
      ref={ref}
      className="dl-svg"
      viewBox={`0 0 ${binW} ${binH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ aspectRatio: `${binW} / ${binH}` }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <defs>
        <pattern id={gridId} width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
          <path
            d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(1, baseFont * 0.04)}
            opacity="0.12"
          />
        </pattern>
      </defs>
      <rect x={0} y={0} width={binW} height={binH} fill={`url(#${gridId})`} />

      {items.map((it, idx) => {
        const colors = getItemColor(it.id)
        const itemName = nameMap[it.id] || `물품${it.id}`
        const itemDim = `${Math.round(it.w)}×${Math.round(it.h)}mm`
        const isHovered = hoveredIdx === idx
        const isDimmed = hoveredIdx !== null && !isHovered

        // 물품 칸을 넘치지 않는 선에서 가장 큰 글자 크기
        const label = `${itemName}${it.rotated ? ' ↻' : ''}`
        const nameFont = Math.min(baseFont, it.h * 0.26, (it.w * 0.86) / Math.max(3, label.length * 0.6))
        const dimFont = nameFont * 0.78
        const showName = nameFont > baseFont * 0.32
        const showDim = showName && it.h > (nameFont + dimFont) * 2.2

        return (
          <g
            key={idx}
            className="dl-svg-item"
            onMouseEnter={() => setHoveredIdx(idx)}
            opacity={isDimmed ? 0.35 : 1}
          >
            <title>{`${itemName} (${itemDim})${it.rotated ? ' [회전됨]' : ''}`}</title>
            <rect
              x={it.x + 1}
              y={it.y + 1}
              width={Math.max(0, it.w - 2)}
              height={Math.max(0, it.h - 2)}
              fill={colors.fill}
              fillOpacity={isHovered ? 1 : 0.88}
              stroke={colors.stroke}
              strokeWidth={isHovered ? 3 : 1.5}
              rx="3"
              ry="3"
            />
            {showName && (
              <text
                className="dl-svg-label"
                x={it.x + it.w / 2}
                y={it.y + it.h / 2 - (showDim ? dimFont * 0.6 : 0)}
                fontSize={nameFont}
                fill={colors.text}
                textAnchor="middle"
                dominantBaseline="middle"
                fontWeight="600"
              >
                {label}
              </text>
            )}
            {showDim && (
              <text
                className="dl-svg-label"
                x={it.x + it.w / 2}
                y={it.y + it.h / 2 + nameFont * 0.75}
                fontSize={dimFont}
                fill={colors.text}
                fillOpacity="0.85"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {itemDim}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
