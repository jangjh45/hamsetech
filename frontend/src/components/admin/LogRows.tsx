import { LOG_ACTION_TONE, type AdminLog } from './adminShared'

/** 변경 이력·조회 이력 탭이 공유하는 로그 행 목록 */
export default function LogRows({ logs, loading }: { logs: AdminLog[]; loading: boolean }) {
  if (loading) return <div className="fl-empty">불러오는 중...</div>
  if (logs.length === 0) return <div className="fl-empty">로그가 없습니다.</div>

  return (
    <>
      {logs.map((log: AdminLog) => (
        <div key={log.id} className="fl-tr ad-log-row">
          <span className="ad-log-time">
            <span className="ad-label">시간</span>
            {log.timestamp}
          </span>

          <span className="ad-log-admin">
            <span className="ad-label">관리자</span>
            {log.adminUsername}
          </span>

          <span>
            <span className="ad-label">작업</span>
            <span className={`fl-badge fl-badge-square ${LOG_ACTION_TONE[log.action] || ''}`}>
              {log.action}
            </span>
          </span>

          <span className="ad-log-detail">
            <span className="ad-label">내용</span>
            {/* 좁은 화면에서 라벨 옆 한 덩어리로 서도록 대상과 상세를 묶는다 */}
            <span className="ad-log-detail-body">
              <span className="ad-log-entity">
                {log.entityType} {log.entityId != null && `(ID: ${log.entityId})`}
              </span>
              {log.details && <span className="ad-log-text">{log.details}</span>}
            </span>
          </span>

          <span className="ad-log-ip">
            <span className="ad-label">IP</span>
            {log.ipAddress || '-'}
          </span>
        </div>
      ))}
    </>
  )
}