import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import { packIntoTrucks, type PackResult } from '../utils/packing'
import { 
  getAllScenarios, 
  getFavoriteScenarios, 
  createScenario, 
  updateScenario, 
  deleteScenario, 
  toggleFavorite,
  type PackingScenario, 
  type CreateScenarioRequest 
} from '../api/scenarios'
import { isAuthenticated, onAuthChange } from '../auth/token'

type ItemRow = { id: number; name: string; w: string; h: string; qty: string }

const colorPalette = [
  { fill: '#60a5fa', stroke: '#2563eb', text: '#ffffff' },
  { fill: '#34d399', stroke: '#059669', text: '#ffffff' },
  { fill: '#fbbf24', stroke: '#d97706', text: '#ffffff' },
  { fill: '#f87171', stroke: '#dc2626', text: '#ffffff' },
  { fill: '#a78bfa', stroke: '#7c3aed', text: '#ffffff' },
  { fill: '#22d3ee', stroke: '#0891b2', text: '#ffffff' },
  { fill: '#a3e635', stroke: '#65a30d', text: '#ffffff' },
  { fill: '#fb923c', stroke: '#ea580c', text: '#ffffff' },
  { fill: '#f472b6', stroke: '#db2777', text: '#ffffff' },
  { fill: '#94a3b8', stroke: '#475569', text: '#ffffff' },
]

const getItemColor = (id: number) => colorPalette[id % colorPalette.length]

function normalizeNumericInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  if (digits === '') return ''
  return String(parseInt(digits, 10)) // 선행 0 제거
}

export default function DeliveryPage() {
  const [binWStr, setBinWStr] = useState<string>('1200')
  const [binHStr, setBinHStr] = useState<string>('800')
  const [allowRotate, setAllowRotate] = useState<boolean>(true)
  const [marginStr, setMarginStr] = useState<string>('0')
  const [items, setItems] = useState<ItemRow[]>([])

  // 로그인 상태
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated())
  
  // 모바일 반응형 상태
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  // 시나리오 관련 상태
  const [scenarios, setScenarios] = useState<PackingScenario[]>([])
  const [favoriteScenarios, setFavoriteScenarios] = useState<PackingScenario[]>([])
  const [showScenarioModal, setShowScenarioModal] = useState<boolean>(false)
  const [showLoadModal, setShowLoadModal] = useState<boolean>(false)
  const [scenarioName, setScenarioName] = useState<string>('')
  const [scenarioDescription, setScenarioDescription] = useState<string>('')
  const [editingScenario, setEditingScenario] = useState<PackingScenario | null>(null)
  const [showNameError, setShowNameError] = useState<boolean>(false)
  const [duplicateNameError, setDuplicateNameError] = useState<boolean>(false) // 중복 이름 에러
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null) // 삭제 확인 모달용

  const nameMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i.name])), [items])

  // 로딩 상태 및 계산 결과
  const [isCalculating, setIsCalculating] = useState<boolean>(false)
  const [result, setResult] = useState<PackResult | null>(null)

  // 디바운스 타이머 ref
  const debounceTimerRef = useRef<number | null>(null)

  // 디바운스된 계산 함수
  const debouncedCalculation = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const binW = parseInt(binWStr || '0', 10)
      const binH = parseInt(binHStr || '0', 10)
      const margin = parseInt(marginStr || '0', 10)
      const rects = items.map(i => ({ id: i.id, w: parseInt(i.w || '0', 10), h: parseInt(i.h || '0', 10), qty: parseInt(i.qty || '0', 10) }))

      if (rects.length === 0 || binW <= 0 || binH <= 0) {
        setResult(null)
        setIsCalculating(false)
        return
      }

      setIsCalculating(true)

      // 비동기로 계산 실행
      setTimeout(() => {
        try {
          const packResult = packIntoTrucks(rects, binW, binH, { allowRotate, margin })
          setResult(packResult)
        } catch (error) {
          console.error('Packing calculation error:', error)
          setResult(null)
        } finally {
          setIsCalculating(false)
        }
      }, 0)
    }, 300) // 300ms 디바운스
  }, [binWStr, binHStr, marginStr, items, allowRotate])

  // 입력 변경 시 디바운스 계산 트리거
  useEffect(() => {
    debouncedCalculation()
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [debouncedCalculation])

  function addItem() {
    const nextId = items.length ? Math.max(...items.map(i => i.id)) + 1 : 1
    setItems([...items, { id: nextId, name: '', w: '200', h: '200', qty: '1' }])
  }

  function updateItem(idx: number, patch: Partial<ItemRow>) {
    const next = [...items]
    next[idx] = { ...next[idx], ...patch }
    setItems(next)
  }

  function removeItem(idx: number) {
    const next = [...items]
    next.splice(idx, 1)
    setItems(next)
  }

  // 드래그 앤 드롭 관련
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  function handleDragStart(idx: number) {
    setDragIndex(idx)
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault()
    if (dragIndex !== null && dragIndex !== idx) {
      setDragOverIndex(idx)
    }
  }

  function handleDragLeave() {
    setDragOverIndex(null)
  }

  function handleDrop(idx: number) {
    if (dragIndex === null || dragIndex === idx) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }
    
    const next = [...items]
    const [draggedItem] = next.splice(dragIndex, 1)
    next.splice(idx, 0, draggedItem)
    setItems(next)
    setDragIndex(null)
    setDragOverIndex(null)
  }

  function handleDragEnd() {
    setDragIndex(null)
    setDragOverIndex(null)
  }

  // 로그인 상태 변경 감지
  useEffect(() => {
    const off = onAuthChange(() => {
      setIsLoggedIn(isAuthenticated())
    })
    return () => off()
  }, [])

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 시나리오 로드 (로그인된 경우에만)
  useEffect(() => {
    if (isLoggedIn) {
      loadScenarios()
    }
  }, [isLoggedIn])

  async function loadScenarios() {
    try {
      const [allScenarios, favorites] = await Promise.all([
        getAllScenarios(),
        getFavoriteScenarios()
      ])
      setScenarios(allScenarios)
      setFavoriteScenarios(favorites)
    } catch (error) {
      console.error('시나리오 로드 실패:', error)
    }
  }

  async function saveScenario() {
    if (!scenarioName.trim()) {
      setShowNameError(true)
      return
    }

    setShowNameError(false)
    setDuplicateNameError(false)
    console.log('저장 시도 - items:', items)
    try {
      // 유효한 물품만 필터링하고, 빈 이름은 기본값으로 대체
      const validItems = items
        .filter(item => {
          const w = parseInt(item.w || '0', 10)
          const h = parseInt(item.h || '0', 10)
          const qty = parseInt(item.qty || '0', 10)
          return w > 0 && h > 0 && qty > 0
        })
        .map((item, index) => ({
          name: item.name.trim() || `물품${index + 1}`,
          width: parseInt(item.w || '0', 10),
          height: parseInt(item.h || '0', 10),
          quantity: parseInt(item.qty || '0', 10)
        }))

      if (validItems.length === 0) {
        console.log('유효한 물품 없음')
        alert('저장할 유효한 물품이 없습니다. 가로, 세로, 수량이 모두 0보다 큰 물품을 추가해주세요.')
        return
      }

      const request: CreateScenarioRequest = {
        name: scenarioName.trim(),
        description: scenarioDescription.trim() || undefined,
        truckWidth: parseInt(binWStr || '0', 10),
        truckHeight: parseInt(binHStr || '0', 10),
        allowRotate,
        margin: parseInt(marginStr || '0', 10),
        items: validItems
      }

      console.log('저장할 데이터:', request)

      if (editingScenario) {
        console.log('시나리오 수정 시작:', editingScenario.id)
        await updateScenario(editingScenario.id!, request)
        console.log('시나리오 수정 완료')
      } else {
        console.log('새 시나리오 생성 시작')
        await createScenario(request)
        console.log('새 시나리오 생성 완료')
      }

      setShowScenarioModal(false)
      setShowLoadModal(false) // 불러오기 모달도 닫기
      setScenarioName('')
      setScenarioDescription('')
      setEditingScenario(null)
      await loadScenarios()
    } catch (error: any) {
      console.error('시나리오 저장 실패:', error)
      
      // HTTP 상태 코드에 따른 에러 메시지
      if (error.message?.includes('400')) {
        setDuplicateNameError(true)
      } else {
        const errorMessage = error.message || '시나리오 저장에 실패했습니다.'
        alert(`시나리오 저장 실패: ${errorMessage}`)
      }
    }
  }

  async function loadScenario(scenario: PackingScenario) {
    setBinWStr(scenario.truckWidth.toString())
    setBinHStr(scenario.truckHeight.toString())
    setAllowRotate(scenario.allowRotate)
    setMarginStr(scenario.margin.toString())

    const newItems: ItemRow[] = scenario.items.map((item, index) => ({
      id: index + 1,
      name: item.name,
      w: item.width.toString(),
      h: item.height.toString(),
      qty: item.quantity.toString()
    }))
    setItems(newItems)

    setShowLoadModal(false)
  }

  async function deleteScenarioHandler(id: number) {
    // 삭제 확인 모달 표시
    setDeleteTargetId(id)
  }

  async function confirmDelete() {
    if (deleteTargetId === null) return
    
    console.log('시나리오 삭제 시도:', deleteTargetId)
    try {
      await deleteScenario(deleteTargetId)
      console.log('시나리오 삭제 성공:', deleteTargetId)
      // 시나리오 목록 다시 로드
      const [allScenarios, favorites] = await Promise.all([
        getAllScenarios(),
        getFavoriteScenarios()
      ])
      setScenarios(allScenarios)
      setFavoriteScenarios(favorites)
      console.log('시나리오 목록 갱신 완료')
    } catch (error) {
      console.error('시나리오 삭제 실패:', error)
      alert('시나리오 삭제에 실패했습니다.')
    } finally {
      setDeleteTargetId(null)
    }
  }

  function cancelDelete() {
    setDeleteTargetId(null)
  }

  async function toggleFavoriteHandler(id: number) {
    try {
      await toggleFavorite(id)
      await loadScenarios()
    } catch (error) {
      console.error('즐겨찾기 토글 실패:', error)
      alert('즐겨찾기 설정에 실패했습니다.')
    }
  }

  function openSaveModal() {
    setEditingScenario(null)
    setScenarioName('')
    setScenarioDescription('')
    setShowNameError(false)
    setShowScenarioModal(true)
  }

  function openEditModal(scenario: PackingScenario) {
    setEditingScenario(scenario)
    setScenarioName(scenario.name)
    setScenarioDescription(scenario.description || '')
    setShowNameError(false)
    setShowLoadModal(false) // 불러오기 모달 닫기
    setShowScenarioModal(true)
  }

  return (
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center',
      alignItems: 'flex-start',
      minHeight: '100vh',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{ 
        maxWidth: 1100, 
        margin: '0 auto', 
        width: '100%',
        textAlign: 'center'
      }}>
        <div style={{ marginBottom: 16 }}>
          <h1 className="title" style={{ margin: 0 }}>적재 시뮬레이터</h1>
          <p className="subtitle" style={{ margin: '4px 0 0 0' }}>트럭 적재함과 물품 크기를 입력해 적재 배치를 확인하세요.</p>
        </div>

        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'stretch' : 'center', 
            gap: isMobile ? 12 : 0,
            marginBottom: 16 
          }}>
            <h3 style={{ margin: 0 }}>트럭 적재함 (단위: mm)</h3>
            {isLoggedIn && (
              <div style={{ 
                display: 'flex', 
                gap: 8,
                flexDirection: isMobile ? 'column' : 'row'
              }}>
                <button className="btn ghost" onClick={() => setShowLoadModal(true)}>
                  📁 불러오기
                </button>
                <button className="btn" onClick={openSaveModal}>
                  💾 저장하기
                </button>
              </div>
            )}
          </div>
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 12 : 16,
            alignItems: isMobile ? 'stretch' : 'flex-end',
            flexWrap: 'wrap'
          }}>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ marginBottom: 6, display: 'block', fontSize: '14px', color: 'var(--muted)' }}>가로 (mm)</label>
              <input className="input" style={{ textAlign: 'center', width: '100px' }} inputMode="numeric" value={binWStr} onChange={e => setBinWStr(normalizeNumericInput(e.target.value))} placeholder="1200" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ marginBottom: 6, display: 'block', fontSize: '14px', color: 'var(--muted)' }}>세로 (mm)</label>
              <input className="input" style={{ textAlign: 'center', width: '100px' }} inputMode="numeric" value={binHStr} onChange={e => setBinHStr(normalizeNumericInput(e.target.value))} placeholder="800" />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label style={{ marginBottom: 6, display: 'block', fontSize: '14px', color: 'var(--muted)' }}>마진 (mm)</label>
              <input className="input" style={{ textAlign: 'center', width: '80px' }} inputMode="numeric" value={marginStr} onChange={e => setMarginStr(normalizeNumericInput(e.target.value))} placeholder="0" />
            </div>
            <label className="field" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
              <input type="checkbox" checked={allowRotate} onChange={e => setAllowRotate(e.target.checked)} /> 회전 허용
            </label>
          </div>
        </section>

        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between', 
            alignItems: isMobile ? 'stretch' : 'center',
            gap: isMobile ? 12 : 0
          }}>
            <h3 style={{ margin: 0 }}>물품 목록</h3>
            <button className="btn" onClick={addItem}>행 추가</button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table" style={{ 
              width: '100%', 
              minWidth: isMobile ? '500px' : 'auto',
              fontSize: isMobile ? '14px' : '16px',
              tableLayout: 'fixed'
            }}>
              <thead>
                <tr>
                  <th style={{ width: '60px', textAlign: 'center', padding: '8px 6px' }}>순서</th>
                  <th style={{ width: isMobile ? '120px' : '180px', textAlign: 'left', padding: '8px 6px' }}>이름</th>
                  <th style={{ width: isMobile ? '180px' : '220px', textAlign: 'center', padding: '8px 6px' }}>치수 (mm)</th>
                  <th style={{ width: '70px', textAlign: 'center', padding: '8px 6px' }}>수량</th>
                  <th style={{ width: '60px', padding: '8px 6px' }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr 
                    key={it.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragLeave={handleDragLeave}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      cursor: 'grab',
                      opacity: dragIndex === idx ? 0.5 : 1,
                      backgroundColor: dragOverIndex === idx ? 'var(--accent-bg)' : 'transparent',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <td style={{ textAlign: 'center', padding: '6px' }}>
                      <span style={{ cursor: 'grab', marginRight: 4, color: 'var(--muted)' }}>⋮⋮</span>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '6px' }}><input className="input" style={{ textAlign: 'left', width: '100%' }} value={it.name} onChange={e => updateItem(idx, { name: e.target.value })} placeholder="예: 박스A" /></td>
                    <td style={{ padding: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                        <input className="input" style={{ textAlign: 'center', width: isMobile ? '80px' : '100px' }} inputMode="numeric" value={it.w} onChange={e => updateItem(idx, { w: normalizeNumericInput(e.target.value) })} placeholder="400" />
                        <span style={{ fontWeight: 'bold', color: 'var(--muted)', fontSize: '14px' }}>✕</span>
                        <input className="input" style={{ textAlign: 'center', width: isMobile ? '80px' : '100px' }} inputMode="numeric" value={it.h} onChange={e => updateItem(idx, { h: normalizeNumericInput(e.target.value) })} placeholder="300" />
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', padding: '6px' }}><input className="input" style={{ textAlign: 'center', width: '60px' }} inputMode="numeric" value={it.qty} onChange={e => updateItem(idx, { qty: normalizeNumericInput(e.target.value) })} /></td>
                    <td style={{ textAlign: 'center', padding: '6px' }}>
                      <button 
                        className="btn ghost" 
                        onClick={() => removeItem(idx)}
                        style={{ 
                          fontSize: isMobile ? '12px' : '14px',
                          padding: isMobile ? '4px 8px' : '6px 12px',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 16,
            flexDirection: isMobile ? 'column' : 'row',
            gap: isMobile ? 8 : 0
          }}>
            <h3 style={{ margin: 0 }}>적재 미리보기</h3>
            {(result || isCalculating) && (
              <div style={{
                padding: '8px 16px',
                backgroundColor: 'var(--accent-bg)',
                borderRadius: '6px',
                border: '1px solid var(--border)'
              }}>
                <p className="subtitle" style={{ margin: 0, color: 'var(--accent-text)' }}>
                  {isCalculating ? (
                    <>계산 중... <span style={{ fontSize: '14px' }}>⏳</span></>
                  ) : (
                    <>
                      총 트럭 수: <b>{result?.count}</b>
                      {' · '}
                      전체 효율:{' '}
                      <b>{Math.round(
                        result!.trucks.reduce((sum, t) => sum + t.reduce((s, it) => s + it.w * it.h, 0), 0) /
                        (result!.count * parseInt(binWStr || '1', 10) * parseInt(binHStr || '1', 10)) * 100
                      )}%</b>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
          
          {!result && (
            <div style={{ 
              padding: '40px 20px', 
              textAlign: 'center',
              color: 'var(--muted)',
              backgroundColor: 'var(--input-bg)',
              borderRadius: '8px',
              border: '1px dashed var(--border)'
            }}>
              <p style={{ margin: 0 }}>입력이 잘못되었거나 아이템이 트럭보다 큽니다.</p>
            </div>
          )}
          
          {result && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center',
              backgroundColor: 'var(--input-bg)',
              borderRadius: '8px',
              padding: '20px',
              border: '1px solid var(--border)',
              overflow: 'hidden'
            }}>
              {result.trucks.map((truck, tIdx) => {
                const binW = parseInt(binWStr || '0', 10)
                const binH = parseInt(binHStr || '0', 10)
                const truckArea = binW * binH
                const itemArea = truck.reduce((sum, it) => sum + it.w * it.h, 0)
                const utilization = truckArea > 0 ? Math.round(itemArea / truckArea * 100) : 0
                const utilizationColor = utilization >= 80 ? '#34d399' : utilization >= 50 ? '#fbbf24' : '#f87171'

                // 이름별 수량 집계
                const summary = truck.reduce<Record<string, { count: number; id: number }>>((acc, it) => {
                  const name = nameMap[it.id] || `#${it.id}`
                  if (!acc[name]) acc[name] = { count: 0, id: it.id }
                  acc[name].count++
                  return acc
                }, {})

                return (
                  <div key={tIdx} style={{
                    width: '100%',
                    maxWidth: isMobile ? '100%' : 720,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    padding: isMobile ? '8px' : '12px'
                  }}>
                    {/* 트럭 헤더 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h4 style={{
                        margin: 0,
                        fontSize: isMobile ? '16px' : '18px',
                        color: 'var(--text)'
                      }}>트럭 #{tIdx + 1}</h4>
                      <span style={{ fontSize: 14, color: utilizationColor, fontWeight: 'bold' }}>
                        적재율 {utilization}%
                      </span>
                    </div>

                    {/* 적재율 바 */}
                    <div style={{
                      height: 6,
                      backgroundColor: 'var(--border)',
                      borderRadius: 3,
                      marginBottom: 12,
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%',
                        width: `${utilization}%`,
                        backgroundColor: utilizationColor,
                        borderRadius: 3,
                        transition: 'width 0.4s ease'
                      }} />
                    </div>

                    {/* SVG */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <TruckSvg binW={binW} binH={binH} items={truck} nameMap={nameMap} />
                    </div>

                    {/* 물품 요약 */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                      {Object.entries(summary).map(([name, { count, id }]) => {
                        const colors = getItemColor(id)
                        return (
                          <div key={name} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '3px 10px',
                            borderRadius: 99,
                            backgroundColor: colors.fill + '22',
                            border: `1px solid ${colors.stroke}`,
                            fontSize: 13
                          }}>
                            <div style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: colors.fill, flexShrink: 0 }} />
                            <span>{name}</span>
                            {count > 1 && (
                              <span style={{ color: colors.stroke, fontWeight: 'bold' }}>×{count}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* 시나리오 저장 모달 */}
      {showScenarioModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1001
          }}
          onClick={() => {
            setShowScenarioModal(false)
            setShowLoadModal(false)
          }}
        >
          <div 
            className="panel" 
            style={{ 
              maxWidth: isMobile ? '95%' : 500, 
              width: isMobile ? '95%' : '90%', 
              maxHeight: '90vh', 
              overflow: 'auto',
              padding: isMobile ? '16px' : '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="title" style={{ marginBottom: 16 }}>
              {editingScenario ? '시나리오 수정' : '시나리오 저장'}
            </h2>
            
            <div className="field">
              <label style={{ textAlign: 'left' }}>시나리오 이름 <span style={{ color: 'red' }}>*</span> <span style={{ fontSize: '12px', color: 'var(--muted)' }}>(* 표시된 항목은 필수 입력입니다)</span></label>
              <input 
                className={`input ${showNameError || duplicateNameError ? 'error' : ''}`}
                value={scenarioName}
                onChange={(e) => {
                  setScenarioName(e.target.value)
                  if (showNameError && e.target.value.trim()) {
                    setShowNameError(false)
                  }
                  if (duplicateNameError) {
                    setDuplicateNameError(false)
                  }
                }}
                placeholder="예: 기본 적재 설정"
                style={(showNameError || duplicateNameError) ? { borderColor: 'red' } : {}}
              />
              {showNameError && (
                <p style={{ color: 'red', fontSize: '12px', margin: '4px 0 0 0' }}>
                  시나리오 이름을 입력해주세요.
                </p>
              )}
              {duplicateNameError && (
                <p style={{ color: 'red', fontSize: '12px', margin: '4px 0 0 0' }}>
                  이미 같은 이름의 시나리오가 존재합니다. 다른 이름을 사용해주세요.
                </p>
              )}
            </div>
            
            <div className="field">
              <label style={{ textAlign: 'left' }}>설명</label>
              <textarea 
                className="input" 
                value={scenarioDescription}
                onChange={(e) => setScenarioDescription(e.target.value)}
                placeholder="시나리오에 대한 설명을 입력하세요"
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button 
                className="btn ghost" 
                onClick={() => {
                  setShowScenarioModal(false)
                  setShowLoadModal(false)
                }}
              >
                취소
              </button>
              <button 
                className="btn" 
                onClick={saveScenario}
              >
                {editingScenario ? '수정' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시나리오 불러오기 모달 */}
      {showLoadModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowLoadModal(false)}
        >
          <div 
            className="panel" 
            style={{ 
              maxWidth: isMobile ? '95%' : 700, 
              width: isMobile ? '95%' : '90%', 
              maxHeight: '90vh', 
              overflow: 'hidden',
              padding: 0,
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: isMobile ? '16px' : '24px',
              paddingBottom: 0,
              flexShrink: 0
            }}>
              <h2 className="title" style={{ margin: 0 }}>시나리오 불러오기</h2>
              <button 
                className="btn ghost" 
                onClick={() => setShowLoadModal(false)}
                style={{ 
                  minWidth: 'auto',
                  padding: '8px 12px',
                  fontSize: '20px',
                  lineHeight: 1
                }}
                title="닫기"
              >
                ✕
              </button>
            </div>

            <div style={{ 
              overflowY: 'auto', 
              padding: isMobile ? '16px' : '24px',
              flex: 1
            }}>
              {/* 즐겨찾기 시나리오 */}
              {favoriteScenarios.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3 style={{ marginBottom: 12, color: 'var(--accent)', textAlign: 'left' }}>⭐ 즐겨찾기</h3>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {favoriteScenarios.map((scenario) => (
                      <ScenarioCard 
                        key={scenario.id}
                        scenario={scenario}
                        onLoad={() => loadScenario(scenario)}
                        onEdit={() => openEditModal(scenario)}
                        onDelete={() => deleteScenarioHandler(scenario.id!)}
                        onToggleFavorite={() => toggleFavoriteHandler(scenario.id!)}
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* 전체 시나리오 */}
              <div>
                <h3 style={{ marginBottom: 12, textAlign: 'left' }}>전체 시나리오</h3>
                {scenarios.length === 0 ? (
                  <p className="subtitle">저장된 시나리오가 없습니다.</p>
                ) : (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {scenarios.map((scenario) => (
                      <ScenarioCard 
                        key={scenario.id}
                        scenario={scenario}
                        onLoad={() => loadScenario(scenario)}
                        onEdit={() => openEditModal(scenario)}
                        onDelete={() => deleteScenarioHandler(scenario.id!)}
                        onToggleFavorite={() => toggleFavoriteHandler(scenario.id!)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {deleteTargetId !== null && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{
            padding: 24,
            maxWidth: 400,
            width: '90%',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: 16 }}>시나리오 삭제</h3>
            <p style={{ marginBottom: 24, color: 'var(--muted)' }}>
              정말로 이 시나리오를 삭제하시겠습니까?<br />
              <span style={{ fontSize: 14, color: 'var(--error, #ef4444)' }}>이 작업은 되돌릴 수 없습니다.</span>
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button 
                className="btn ghost" 
                onClick={cancelDelete}
                style={{ minWidth: 80 }}
              >
                취소
              </button>
              <button 
                className="btn" 
                onClick={confirmDelete}
                style={{ 
                  minWidth: 80, 
                  backgroundColor: 'var(--error, #ef4444)',
                  borderColor: 'var(--error, #ef4444)'
                }}
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// 시나리오 카드 컴포넌트
function ScenarioCard({ 
  scenario, 
  onLoad, 
  onEdit, 
  onDelete, 
  onToggleFavorite 
}: { 
  scenario: PackingScenario
  onLoad: () => void
  onEdit: () => void
  onDelete: () => void
  onToggleFavorite: () => void
}) {
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <div className="card" style={{ padding: isMobile ? 12 : 16 }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row',
        justifyContent: 'space-between', 
        alignItems: isMobile ? 'stretch' : 'flex-start', 
        gap: isMobile ? 8 : 0,
        marginBottom: 8 
      }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            {scenario.name}
            {scenario.isFavorite && <span style={{ color: '#fbbf24' }}>⭐</span>}
          </h4>
          {scenario.description && (
            <p className="subtitle" style={{ margin: '4px 0 0 0' }}>{scenario.description}</p>
          )}
        </div>
        <button 
          className="btn ghost" 
          onClick={onToggleFavorite}
          style={{ 
            padding: '4px 8px', 
            minWidth: 'auto',
            alignSelf: isMobile ? 'flex-start' : 'auto'
          }}
          title={scenario.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
        >
          {scenario.isFavorite ? '⭐' : '☆'}
        </button>
      </div>
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(120px, 1fr))', 
        gap: 8, 
        marginBottom: 12, 
        fontSize: isMobile ? 12 : 14, 
        color: 'var(--muted)' 
      }}>
        <div>트럭: {scenario.truckWidth}×{scenario.truckHeight}mm</div>
        <div>아이템: {scenario.items.length}개</div>
        <div>회전: {scenario.allowRotate ? '허용' : '비허용'}</div>
        <div>마진: {scenario.margin}mm</div>
      </div>
      
      <div style={{ 
        display: 'flex', 
        gap: 8, 
        justifyContent: 'flex-end',
        flexDirection: isMobile ? 'column' : 'row'
      }}>
        <button className="btn ghost" onClick={onEdit} style={{ fontSize: isMobile ? 14 : 12 }}>
          ✏️ 수정
        </button>
        <button className="btn ghost" onClick={onDelete} style={{ fontSize: isMobile ? 14 : 12 }}>
          🗑️ 삭제
        </button>
        <button className="btn" onClick={onLoad} style={{ fontSize: isMobile ? 14 : 12 }}>
          📂 불러오기
        </button>
      </div>
    </div>
  )
}

function TruckSvg({ binW, binH, items, nameMap }: { binW: number; binH: number; items: ReturnType<typeof packIntoTrucks>['trucks'][number]; nameMap: Record<number, string> }) {
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const maxPxW = isMobile ? Math.min(280, window.innerWidth - 80) : 520
  const maxPxH = isMobile ? 200 : 360
  const scale = Math.min(maxPxW / binW, maxPxH / binH)
  const width = Math.max(1, binW * scale)
  const height = Math.max(1, binH * scale)
  const visualPadding = 1
  const idFontSize = Math.max(2, 12 / scale)
  const subFontSize = Math.max(2, 10 / scale)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${binW} ${binH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{
        border: '2px solid var(--border)',
        background: 'var(--input-bg)',
        borderRadius: '4px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
        cursor: 'default'
      }}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      <defs>
        <pattern id="grid" width={100} height={100} patternUnits="userSpaceOnUse">
          <path d="M 100 0 L 0 0 0 100" fill="none" stroke="var(--border)" strokeWidth="0.5" opacity="0.3"/>
        </pattern>
      </defs>
      <rect x={0} y={0} width={binW} height={binH} fill="url(#grid)" />

      {items.map((it, idx) => {
        const colors = getItemColor(it.id)
        const itemName = nameMap[it.id] || `#${it.id}`
        const itemDim = `${Math.round(it.w)}×${Math.round(it.h)}mm`
        const isHovered = hoveredIdx === idx
        const isDimmed = hoveredIdx !== null && !isHovered

        return (
          <g
            key={idx}
            onMouseEnter={() => setHoveredIdx(idx)}
            style={{ cursor: 'pointer' }}
          >
            <title>{`${itemName} (${itemDim})${it.rotated ? ' [회전됨]' : ''}`}</title>
            <rect
              x={it.x + visualPadding}
              y={it.y + visualPadding}
              width={Math.max(0, it.w - visualPadding * 2)}
              height={Math.max(0, it.h - visualPadding * 2)}
              fill={colors.fill}
              opacity={isDimmed ? 0.35 : isHovered ? 1.0 : 0.85}
              stroke={colors.stroke}
              strokeWidth={isHovered ? 3 : 1.5}
              rx="2" ry="2"
              style={{ transition: 'opacity 0.15s, stroke-width 0.15s' }}
            />
            <text
              x={it.x + it.w / 2}
              y={it.y + it.h / 2 - subFontSize / 2}
              fontSize={idFontSize}
              fill={colors.text}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={isDimmed ? 0.4 : 1}
              style={{ fontWeight: 'bold', pointerEvents: 'none', userSelect: 'none' }}
            >
              {itemName}{it.rotated ? ' ↻' : ''}
            </text>
            <text
              x={it.x + it.w / 2}
              y={it.y + it.h / 2 + idFontSize / 2 + 2}
              fontSize={subFontSize}
              fill={colors.text}
              textAnchor="middle"
              dominantBaseline="middle"
              opacity={isDimmed ? 0.3 : 0.9}
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {itemDim}
            </text>
          </g>
        )
      })}
    </svg>
  )
}


