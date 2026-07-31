import {
  WIDGET_LABELS,
  DEFAULT_LAYOUT,
  isHidden,
  toggleHidden,
  moveWidget,
  type HomeLayout,
} from '../utils/homeLayout'

interface HomeEditPanelProps {
  layout: HomeLayout
  onChange: (next: HomeLayout) => void
  onClose: () => void
  isMobile: boolean
}

export default function HomeEditPanel({ layout, onChange, onClose, isMobile }: HomeEditPanelProps) {
  return (
    <div
      className="card"
      style={{
        padding: isMobile ? 12 : 16,
        marginTop: isMobile ? 8 : 16,
        marginBottom: isMobile ? 8 : 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? 10 : 14,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16 }}>메인화면 편집</div>
        <button className="btn ghost" onClick={onClose} style={{ padding: '6px 12px' }}>
          완료
        </button>
      </div>

      <div style={{ fontSize: isMobile ? 12 : 13, opacity: 0.7, marginBottom: isMobile ? 10 : 12 }}>
        위젯을 숨기거나 표시 순서를 바꿀 수 있습니다.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 8 : 10 }}>
        {layout.order.map((id, index) => {
          const hidden = isHidden(layout, id)
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? 8 : 12,
                background: 'rgba(109, 139, 255, 0.05)',
                border: '1px solid rgba(109, 139, 255, 0.15)',
                borderRadius: 10,
                padding: isMobile ? '10px 12px' : '12px 14px',
                opacity: hidden ? 0.55 : 1,
              }}
            >
              {/* 표시/숨김 토글 */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={!hidden}
                  onChange={() => onChange(toggleHidden(layout, id))}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer', flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: isMobile ? 14 : 15,
                    fontWeight: 500,
                    textDecoration: hidden ? 'line-through' : 'none',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {WIDGET_LABELS[id]}
                </span>
              </label>

              {/* 순서 이동 */}
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  className="btn ghost"
                  onClick={() => onChange(moveWidget(layout, id, 'up'))}
                  disabled={index === 0}
                  aria-label="위로 이동"
                  style={{
                    padding: '6px 10px',
                    opacity: index === 0 ? 0.3 : 1,
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ↑
                </button>
                <button
                  className="btn ghost"
                  onClick={() => onChange(moveWidget(layout, id, 'down'))}
                  disabled={index === layout.order.length - 1}
                  aria-label="아래로 이동"
                  style={{
                    padding: '6px 10px',
                    opacity: index === layout.order.length - 1 ? 0.3 : 1,
                    cursor: index === layout.order.length - 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  ↓
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: isMobile ? 12 : 14 }}>
        <button
          className="btn ghost"
          onClick={() => onChange({ ...DEFAULT_LAYOUT })}
          style={{ padding: '6px 12px', fontSize: isMobile ? 13 : 14 }}
        >
          기본값으로 초기화
        </button>
      </div>
    </div>
  )
}
