import { useState } from 'react'
import type { Placed } from '../../utils/packing'
import { getItemColor } from './deliveryShared'

/**
 * 적재함 한 대의 도면.
 *
 * SVG는 칸 폭에 맞춰 늘어나므로 글자 크기도 화면 px이 아니라 적재함 좌표계로 잡는다.
 * 항목에 마우스를 올리면 그 항목만 밝아지고 나머지는 흐려진다 — 물품이 많을 때
 * 어느 칸이 무엇인지 확인할 수 있게 하는 것이 목적이다.
 */
export default function TruckSvg({
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