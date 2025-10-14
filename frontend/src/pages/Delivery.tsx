import { useMemo, useState } from 'react'
import { packIntoTrucks, type Rect, type PackResult } from '../utils/packing'

type ItemRow = { id: number; name: string; w: string; h: string; qty: string }

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
  const [items, setItems] = useState<ItemRow[]>([
    { id: 1, name: '박스A', w: '400', h: '300', qty: '1' },
    { id: 2, name: '박스B', w: '600', h: '400', qty: '1' },
  ])

  const binW = useMemo(() => parseInt(binWStr || '0', 10), [binWStr])
  const binH = useMemo(() => parseInt(binHStr || '0', 10), [binHStr])
  const margin = useMemo(() => parseInt(marginStr || '0', 10), [marginStr])

  const rects: Rect[] = useMemo(() => items.map(i => ({ id: i.id, w: parseInt(i.w || '0', 10), h: parseInt(i.h || '0', 10), qty: parseInt(i.qty || '0', 10) })), [items])
  const nameMap = useMemo(() => Object.fromEntries(items.map(i => [i.id, i.name])), [items])

  const result: PackResult | null = useMemo(() => {
    try {
      return packIntoTrucks(rects, binW, binH, { allowRotate, margin })
    } catch {
      return null
    }
  }, [rects, binW, binH, allowRotate, margin])

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

  return (
    <div className="container">
      <div className="panel" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <h1 className="title">적재 시뮬레이터</h1>
        <p className="subtitle">트럭 적재함과 물품 크기를 입력해 적재 배치를 확인하세요.</p>

        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <h3>트럭 적재함 (단위: mm)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <label className="field">가로(W, mm)
              <input className="input" inputMode="numeric" value={binWStr} onChange={e => setBinWStr(normalizeNumericInput(e.target.value))} placeholder="예: 1200" />
            </label>
            <label className="field">세로(H, mm)
              <input className="input" inputMode="numeric" value={binHStr} onChange={e => setBinHStr(normalizeNumericInput(e.target.value))} placeholder="예: 800" />
            </label>
            <label className="field">마진(mm)
              <input className="input" inputMode="numeric" value={marginStr} onChange={e => setMarginStr(normalizeNumericInput(e.target.value))} placeholder="0" />
            </label>
            <label className="field" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={allowRotate} onChange={e => setAllowRotate(e.target.checked)} /> 회전 허용
            </label>
          </div>
        </section>

        <section className="card" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>물품 목록</h3>
            <button className="btn" onClick={addItem}>행 추가</button>
          </div>
          <div style={{ overflowX: 'auto', marginTop: 12 }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>이름</th>
                  <th>가로(W, mm)</th>
                  <th>세로(H, mm)</th>
                  <th>수량</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id}>
                    <td>{it.id}</td>
                    <td><input className="input" value={it.name} onChange={e => updateItem(idx, { name: e.target.value })} placeholder="예: 박스A" /></td>
                    <td><input className="input" style={{ maxWidth: 140 }} inputMode="numeric" value={it.w} onChange={e => updateItem(idx, { w: normalizeNumericInput(e.target.value) })} /></td>
                    <td><input className="input" style={{ maxWidth: 140 }} inputMode="numeric" value={it.h} onChange={e => updateItem(idx, { h: normalizeNumericInput(e.target.value) })} /></td>
                    <td><input className="input" style={{ maxWidth: 120 }} inputMode="numeric" value={it.qty} onChange={e => updateItem(idx, { qty: normalizeNumericInput(e.target.value) })} /></td>
                    <td><button className="btn ghost" onClick={() => removeItem(idx)}>삭제</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card" style={{ padding: 16 }}>
          <h3>적재 미리보기</h3>
          {!result && <p>입력이 잘못되었거나 아이템이 트럭보다 큽니다.</p>}
          {result && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'center'
            }}>
              {result.trucks.map((truck, tIdx) => (
                <div key={tIdx} style={{ width: '100%', maxWidth: 720, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <h4 style={{ marginTop: 0 }}>트럭 #{tIdx + 1}</h4>
                  <TruckSvg binW={binW} binH={binH} items={truck} nameMap={nameMap} />
                </div>
              ))}
            </div>
          )}
          {result && (
            <p className="subtitle" style={{ marginTop: 12 }}>총 트럭 수: <b>{result.count}</b></p>
          )}
        </section>
      </div>
    </div>
  )
}

function TruckSvg({ binW, binH, items, nameMap }: { binW: number; binH: number; items: ReturnType<typeof packIntoTrucks>['trucks'][number]; nameMap: Record<number, string> }) {
  // 컨테이너에 맞춰 자동 스케일: 큰 값도 화면 안에 들어오도록 축소
  const maxPxW = 520
  const maxPxH = 360
  const scale = Math.min(maxPxW / binW, maxPxH / binH)
  const width = Math.max(1, binW * scale)
  const height = Math.max(1, binH * scale)
  const visualPadding = 1 // 필요 시 0~1mm 여백
  // 글자 크기를 화면 픽셀 기준으로 유지하기 위해 viewBox 단위로 환산
  const idFontSize = Math.max(2, 12 / scale) // 약 12px
  const subFontSize = Math.max(2, 10 / scale) // 약 10px

  // 물건별 색상 팔레트 (ID 기반으로 색상 할당)
  const colorPalette = [
    { fill: '#3b82f6', stroke: '#1d4ed8' }, // 파란색
    { fill: '#10b981', stroke: '#047857' }, // 초록색
    { fill: '#f59e0b', stroke: '#d97706' }, // 주황색
    { fill: '#ef4444', stroke: '#dc2626' }, // 빨간색
    { fill: '#8b5cf6', stroke: '#7c3aed' }, // 보라색
    { fill: '#06b6d4', stroke: '#0891b2' }, // 청록색
    { fill: '#84cc16', stroke: '#65a30d' }, // 라임색
    { fill: '#f97316', stroke: '#ea580c' }, // 오렌지색
  ]

  const getItemColor = (id: number) => colorPalette[id % colorPalette.length]

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${binW} ${binH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ border: '1px solid var(--border)', background: 'transparent' }}
    >
      <rect x={0} y={0} width={binW} height={binH} fill="transparent" stroke="var(--border)" />
      {items.map((it, idx) => {
        const colors = getItemColor(it.id)
        return (
          <g key={idx}>
            <rect
              x={it.x + visualPadding}
              y={it.y + visualPadding}
              width={Math.max(0, it.w - visualPadding * 2)}
              height={Math.max(0, it.h - visualPadding * 2)}
              fill={colors.fill}
              opacity="0.3"
              stroke={colors.stroke}
              strokeWidth="0.5"
            />
            <text x={it.x + 1 + visualPadding} y={it.y + idFontSize + visualPadding} fontSize={idFontSize} fill="var(--text)">{nameMap[it.id] || `#${it.id}`}{it.rotated ? '↻' : ''}</text>
            <text x={it.x + 1 + visualPadding} y={it.y + idFontSize + subFontSize + visualPadding} fontSize={subFontSize} fill="var(--text)">{`${Math.round(it.w)}×${Math.round(it.h)}mm`}</text>
          </g>
        )
      })}
    </svg>
  )
}


