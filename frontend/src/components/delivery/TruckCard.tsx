import { useRef } from 'react'
import type { Placed } from '../../utils/packing'
import TruckSvg from './TruckSvg'
import { downloadTruckImage } from './downloadTruckImage'
import { figureWidth, getItemColor, rateTone } from './deliveryShared'

/**
 * 트럭 한 대의 카드. 접기, 적재율 막대, 도면, 이름별 수량 칩을 담는다.
 *
 * 접었을 때 DOM에서 지우지 않고 CSS로 숨긴다. 인쇄할 때는 접힌 트럭도 나와야 하는데
 * DOM에 없으면 @media print로 되살릴 수가 없다.
 */
export default function TruckCard({
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