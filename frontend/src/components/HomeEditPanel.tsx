import { useState, type DragEvent } from 'react'
import {
  WIDGET_LABELS,
  DEFAULT_LAYOUT,
  isHidden,
  toggleHidden,
  moveWidget,
  reorderWidget,
  type HomeLayout,
  type WidgetId,
} from '../utils/homeLayout'

interface HomeEditPanelProps {
  layout: HomeLayout
  onChange: (next: HomeLayout) => void
  onClose: () => void
}

export default function HomeEditPanel({ layout, onChange, onClose }: HomeEditPanelProps) {
  const [dragId, setDragId] = useState<WidgetId | null>(null)
  const [overId, setOverId] = useState<WidgetId | null>(null)

  function handleDragStart(e: DragEvent<HTMLDivElement>, id: WidgetId) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    // Firefox는 데이터가 설정되어야 드래그를 시작한다
    e.dataTransfer.setData('text/plain', id)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>, id: WidgetId) {
    if (!dragId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== overId) setOverId(id)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>, id: WidgetId) {
    e.preventDefault()
    if (dragId) onChange(reorderWidget(layout, dragId, id))
    setDragId(null)
    setOverId(null)
  }

  function handleDragEnd() {
    setDragId(null)
    setOverId(null)
  }

  return (
    <div className="fl-card fl-edit-panel">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 6,
        }}
      >
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>메인화면 편집</div>
          <div style={{ fontSize: 13, color: 'var(--fl-muted)', marginTop: 4 }}>
            위젯을 숨기거나 드래그해서 순서를 바꿀 수 있습니다.
          </div>
        </div>
        <button className="fl-btn" onClick={onClose}>
          완료
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {layout.order.map((id, index) => {
          const hidden = isHidden(layout, id)
          const classes = [
            'fl-edit-row',
            hidden ? 'is-hidden' : '',
            dragId === id ? 'is-dragging' : '',
            overId === id && dragId !== id ? 'is-over' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <div
              key={id}
              className={classes}
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
            >
              <span className="fl-drag-handle" aria-hidden="true" title="드래그해서 순서 변경">
                ⠿
              </span>

              <label className={`fl-edit-label${hidden ? ' is-hidden' : ''}`}>
                <input
                  type="checkbox"
                  className="fl-check"
                  checked={!hidden}
                  onChange={() => onChange(toggleHidden(layout, id))}
                />
                <span
                  style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {WIDGET_LABELS[id]}
                </span>
              </label>

              {/* 터치 기기와 키보드에서는 드래그가 동작하지 않으므로 ↑↓를 남겨둔다 */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="fl-btn-icon fl-btn-sm"
                  onClick={() => onChange(moveWidget(layout, id, 'up'))}
                  disabled={index === 0}
                  aria-label={`${WIDGET_LABELS[id]} 위로 이동`}
                >
                  ↑
                </button>
                <button
                  className="fl-btn-icon fl-btn-sm"
                  onClick={() => onChange(moveWidget(layout, id, 'down'))}
                  disabled={index === layout.order.length - 1}
                  aria-label={`${WIDGET_LABELS[id]} 아래로 이동`}
                >
                  ↓
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="fl-btn" onClick={() => onChange({ ...DEFAULT_LAYOUT })}>
          기본값으로 초기화
        </button>
      </div>
    </div>
  )
}
