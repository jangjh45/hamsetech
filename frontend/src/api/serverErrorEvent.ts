/** 서버 장애(5xx)나 연결 실패를 화면 전역 알림으로 알리는 window 이벤트 이름. */
export const SERVER_ERROR_EVENT = 'api-server-error'

export interface ServerErrorDetail {
  kind: 'server' | 'network'
  status?: number
}
