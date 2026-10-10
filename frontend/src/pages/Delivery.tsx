import { useMemo, useState, useEffect, useCallback } from 'react'
import { MAX_PIECES } from '../utils/packing'
import type { PackingScenario } from '../api/scenarios'
import ScenarioRow from '../components/delivery/ScenarioRow'
import TruckCard from '../components/delivery/TruckCard'
import {
  BIN_PRESETS,
  DRAFT_KEY,
  TRUCK_PAGE,
  loadDraft,
  normalizeNumericInput,
  toInt,
  toSquareMeters,
  type Draft,
} from '../components/delivery/deliveryShared'
import { useScenarios } from '../hooks/useScenarios'
import { usePackingCalc, usePackingStats } from '../hooks/usePackingCalc'
import { useItemRows } from '../hooks/useItemRows'
import { useConfirm } from '../components/ConfirmDialog'
import '../styles/delivery.css'

export default function DeliveryPage() {
  const { confirm } = useConfirm()
  const [initialDraft] = useState<Draft | null>(loadDraft)

  const [binWStr, setBinWStr] = useState<string>(initialDraft?.binW ?? '1200')
  const [binHStr, setBinHStr] = useState<string>(initialDraft?.binH ?? '800')
  const [marginStr, setMarginStr] = useState<string>(initialDraft?.margin ?? '0')
  const [allowRotate, setAllowRotate] = useState<boolean>(initialDraft?.allowRotate ?? true)
  const [preserveOrder, setPreserveOrder] = useState<boolean>(initialDraft?.preserveOrder ?? false)

  const [error, setError] = useState<string>('')
  const [showRestoredHint, setShowRestoredHint] = useState<boolean>(!!initialDraft)

  // 물품 목록 편집과 드래그 정렬. 같은 items를 두 가지 방식으로 만지므로 한 묶음이다.
  const {
    items,
    setItems,
    lastRemoved,
    setLastRemoved,
    focusItemIdRef,
    addItem,
    duplicateItem,
    updateItem,
    removeItem,
    undoRemove,
    clearItems,
    dragIndex,
    setDragIndex,
    dragOverIndex,
    setDragOverIndex,
    handleDragOver,
    handleDrop,
    handleDragEnd,
  } = useItemRows(initialDraft?.items ?? [])


  const nameMap = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i.name])), [items])

  // 계산 상태 및 결과. 이름은 그대로 풀어 쓴다 — 아래쪽 렌더가 전부 이 이름들을
  // 참조하고, 접두사를 붙이면 렌더 부분을 전부 손대야 한다.
  const {
    isCalculating,
    result,
    collapsedTrucks,
    setCollapsedTrucks,
    visibleTrucks,
    setVisibleTrucks,
    binW,
    binH,
    margin,
  } = usePackingCalc({ binWStr, binHStr, marginStr, allowRotate, preserveOrder, items })

  // 훅에 넘길 두 함수. useCallback으로 감싸지 않으면 매 렌더마다 새 함수가 생겨
  // 컴포넌트 전체가 memoize되지 않는다 — React Compiler가 최적화를 건너뛰고
  // preserve-manual-memoization 오류를 붙인다.
  const getInput = useCallback(
    () => ({
      binW: toInt(binWStr),
      binH: toInt(binHStr),
      margin: toInt(marginStr),
      allowRotate,
      preserveOrder,
      items,
    }),
    [binWStr, binHStr, marginStr, allowRotate, preserveOrder, items],
  )

  const applyScenario = useCallback((s: PackingScenario) => {
    setBinWStr(String(s.truckWidth))
    setBinHStr(String(s.truckHeight))
    setAllowRotate(s.allowRotate)
    setMarginStr(String(s.margin))
    setPreserveOrder(!!s.preserveOrder)
    // 서버가 sortOrder 순으로 내려주므로 받은 순서 그대로 쓴다
    setItems(
      s.items.map((item, index) => ({
        id: index + 1,
        name: item.name,
        w: String(item.width),
        h: String(item.height),
        qty: String(item.quantity),
      })),
    )
    setLastRemoved(null)
    setShowRestoredHint(false)
  }, [])

  // 시나리오 상태는 useScenarios가 들고 있다. 이름을 그대로 풀어 놓는 이유는
  // 이 화면 아래쪽 JSX가 전부 이 이름들을 참조하기 때문이다 — 접두사를 붙이려면
  // 렌더 부분을 전부 손대야 한다.
  const {
    scenarios,
    favoriteScenarios,
    showScenarioModal,
    showLoadModal,
    setShowLoadModal,
    scenarioQuery,
    setScenarioQuery,
    scenarioName,
    setScenarioName,
    scenarioDescription,
    setScenarioDescription,
    editingScenario,
    formError,
    setFormError,
    saving,
    deleteTarget,
    setDeleteTarget,
    saveScenario,
    loadScenario,
    confirmDelete,
    toggleFavoriteHandler,
    openSaveModal,
    openEditModal,
    closeScenarioModal,
  } = useScenarios({ getInput, applyScenario, onError: setError })

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

  // ── 전체 초기화 ────────────────────────────────────────────

  async function resetInputs() {
    const ok = await confirm({
      title: '입력 내용 초기화',
      message: '입력한 적재함 설정과 물품 목록을 모두 지울까요?',
      confirmText: '초기화',
      variant: 'danger',
    })
    if (!ok) return
    setBinWStr('1200')
    setBinHStr('800')
    setMarginStr('0')
    setAllowRotate(true)
    setPreserveOrder(false)
    clearItems()
    setShowRestoredHint(false)
    try {
      localStorage.removeItem(DRAFT_KEY)
    } catch {
      // 지우기 실패는 무시. 다음 편집 때 어차피 덮어쓴다.
    }
  }

  // ── 시나리오 ───────────────────────────────────────────────

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

  const stats = usePackingStats({ items, result, binW, binH })

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

