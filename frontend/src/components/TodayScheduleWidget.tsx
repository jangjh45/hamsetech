import { Fragment } from 'react'
import type { CalendarEvent } from '../api/calendar'
import { formatTime } from '../utils/formatDate'

interface TodayScheduleWidgetProps {
  events: CalendarEvent[]
  /**
   * 캘린더 위젯에서 오늘 날짜를 선택하고 그쪽으로 스크롤한다.
   * 캘린더가 숨겨져 있으면 넘기지 않으며, 그 경우 하단 링크도 렌더링하지 않는다.
   */
  onShowAll?: () => void
}

const MAX_VISIBLE = 3

export default function TodayScheduleWidget({ events, onShowAll }: TodayScheduleWidgetProps) {
  const sorted = [...events].sort((a, b) => (a.time || '').localeCompare(b.time || ''))
  const visible = sorted.slice(0, MAX_VISIBLE)

  return (
    <>
      <div className="fl-card-head fl-plain">
        <span className="fl-card-title">오늘 일정</span>
        <span className="fl-card-count">{sorted.length}건</span>
      </div>

      <div className="fl-card-body">
        {visible.length === 0 ? (
          <div className="fl-empty">오늘 등록된 일정이 없습니다.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {visible.map((event, index) => (
              <Fragment key={event.id}>
                {index > 0 && <div style={{ height: 1, background: 'var(--fl-divider)' }} />}
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="fl-row-time" style={{ paddingTop: 1 }}>
                    {formatTime(event.time) || '종일'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, wordBreak: 'break-word' }}>
                      {event.title}
                    </div>
                    {event.scope === 'COMPANY' && (
                      <div style={{ fontSize: 13, color: 'var(--fl-muted)', marginTop: 2 }}>
                        전체 공유
                        {event.createdByDisplayName ? ` · ${event.createdByDisplayName}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            ))}
            {sorted.length > MAX_VISIBLE && (
              <div style={{ fontSize: 13, color: 'var(--fl-muted)' }}>
                외 {sorted.length - MAX_VISIBLE}건
              </div>
            )}
          </div>
        )}
      </div>

      {onShowAll && (
        <div className="fl-card-foot">
          <button className="fl-link" onClick={onShowAll}>
            일정 전체 보기 →
          </button>
        </div>
      )}
    </>
  )
}
