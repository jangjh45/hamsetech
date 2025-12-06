import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { getUsername as getMe, getToken, getRoles, saveAuth, onTokenExpired } from '../auth/token'
import '../styles/admin.css'

interface AdminLog {
  id: number
  timestamp: string
  adminUsername: string
  action: string
  entityType: string
  entityId: number | null
  details: string | null
  ipAddress: string | null
}

export default function AdminPage() {
  const [msg, setMsg] = useState('loading...')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [tokenExpired, setTokenExpired] = useState(false)
  const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users')
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logStats, setLogStats] = useState<any>(null)
  const [logPagination, setLogPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,
    size: 20
  })
  const [logFilters, setLogFilters] = useState({
    adminUsername: '',
    entityType: '',
    action: '',
    startDate: '',
    endDate: ''
  })
  const navigate = useNavigate()

  useEffect(() => {
    const me = getMe()
    const roles = getRoles()
    if (roles.includes('SUPER_ADMIN')) {
      setMsg(`현재 로그인된 계정${me ? ` (${me})` : ''}은 슈퍼관리자입니다.`)
    } else if (roles.includes('ADMIN')) {
      setMsg(`현재 로그인된 계정${me ? ` (${me})` : ''}은 관리자입니다.`)
    } else {
      setMsg(`현재 로그인된 계정${me ? ` (${me})` : ''}은 관리자 권한이 없습니다.`)
    }
  }, [])

  // 토큰 만료 이벤트 리스너 설정
  useEffect(() => {
    const unsubscribe = onTokenExpired(() => {
      setTokenExpired(true)
      setError('세션이 만료되었습니다. 다시 로그인해주세요.')
    })
    
    return unsubscribe
  }, [])

  async function loadUsers(query = q) {
    try {
      const search = query ? `?q=${encodeURIComponent(query)}` : ''
      const list = await apiFetch(`/api/admin/users${search}`)
      setUsers(list as any[])
    } catch (e: any) {
      setError(e.message || 'load failed')
    }
  }

  async function loadLogs(page: number = 0, customSize?: number) {
    try {
      setLogsLoading(true)
      const pageSize = customSize !== undefined ? customSize : logPagination.size
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(logFilters).filter(([_, value]) => value && value.trim() !== '')
        )
      })
      const result = await apiFetch(`/api/admin/logs?${params}`)

      // 페이징 정보와 로그 데이터 분리
      if (result.content) {
        setLogs(result.content)
        setLogPagination({
          currentPage: result.number || 0,
          totalPages: result.totalPages || 0,
          totalElements: result.totalElements || 0,
          size: result.size || 20
        })
      } else {
        // 페이징이 없는 경우 (하위 호환성)
        setLogs(result)
        setLogPagination({
          currentPage: 0,
          totalPages: 1,
          totalElements: result.length,
          size: 20
        })
      }
    } catch (e: any) {
      setError(e.message || '로그 로드 실패')
    } finally {
      setLogsLoading(false)
    }
  }

  async function loadLogStats() {
    try {
      const stats = await apiFetch('/api/admin/logs/stats')
      setLogStats(stats)
    } catch (e: any) {
      setError(e.message || '통계 로드 실패')
    }
  }

  useEffect(() => { loadUsers('') }, [])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(0) // 탭 변경 시 첫 페이지로 이동
      loadLogStats()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(0) // 필터 변경 시 첫 페이지로 이동
    }
  }, [logFilters])

  async function grant(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/grant-admin`, { method: 'POST' })
      await loadUsers()
    } catch (e: any) { setError(e.message) }
  }

  async function revoke(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/revoke-admin`, { method: 'POST' })
      await loadUsers()
      // If current user revoked self, drop ADMIN locally and leave admin page
      const me = getMe()
      const target = users.find(u => u.id === id)
      if (target && me && target.username === me) {
        const token = getToken()
        const roles = getRoles().filter(r => r !== 'ADMIN')
        if (token) {
          saveAuth(token, roles, me)
        }
        navigate('/')
      }
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="admin-container">
      <div className="admin-header">
        <h1 className="admin-title">관리자</h1>
        <p className="admin-subtitle">ADMIN 권한이 있어야 접근할 수 있습니다</p>
      </div>

      {/* 탭 메뉴 */}
      <div className="admin-tabs">
        <button
          className={`admin-tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          사용자 관리
        </button>
        <button
          className={`admin-tab-button ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          활동 로그
        </button>
      </div>

      {tokenExpired && (
        <div className="admin-alert danger">
          <strong>세션 만료 알림</strong>
          로그인 세션이 만료되었습니다. 잠시 후 로그인 페이지로 이동됩니다.
        </div>
      )}
      
      {error ? (
        <div className="admin-alert danger">{error}</div>
      ) : (
        <div className="admin-alert info">{msg}</div>
      )}

      {activeTab === 'users' && (
        <div className="admin-content">
          <div className="admin-controls">
            <div className="admin-search-wrapper">
              <input
                className="input"
                placeholder="사용자 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn ghost" onClick={() => loadUsers(q)}>검색</button>
            </div>
          </div>

          <div className="admin-table-container">
            {/* 데스크톱 헤더 */}
            <div className="admin-table-header user-grid">
              <div style={{ textAlign: 'center' }}>ID</div>
              <div>사용자명</div>
              <div>역할</div>
              <div style={{ textAlign: 'center' }}>이름/닉네임 관리</div>
              <div style={{ textAlign: 'center' }}>권한</div>
            </div>

            {users.length === 0 ? (
              <div className="admin-empty-state">사용자가 없습니다.</div>
            ) : (
              users.map((u: any) => {
                const roles = u.roles || []
                const isAdmin = roles.includes('ADMIN')
                const isSuperAdmin = roles.includes('SUPER_ADMIN')
                
                return (
                  <div key={u.id} className="admin-table-row user-grid">
                    <div className="mobile-row-item">
                      <span className="mobile-label">ID</span>
                      <div style={{ textAlign: 'center' }}>{u.id}</div>
                    </div>
                    
                    <div className="mobile-row-item">
                      <span className="mobile-label">사용자</span>
                      <div style={{ fontWeight: 500 }}>
                        {u.username}{u.displayName ? ` (${u.displayName})` : ''}
                      </div>
                    </div>
                    
                    <div className="mobile-row-item">
                      <span className="mobile-label">역할</span>
                      <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                        {roles.join(', ')}
                      </div>
                    </div>
                    
                    <div className="mobile-row-item" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                      <span className="mobile-label" style={{ marginBottom: 4 }}>닉네임 변경</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {(() => {
                          let inputEl: HTMLInputElement | null = null;
                          return (
                            <>
                              <input 
                                ref={(el) => { inputEl = el }} 
                                className="input" 
                                placeholder="이름/닉네임" 
                                defaultValue={u.displayName || ''} 
                                style={{ flex: 1, padding: '6px 10px', fontSize: '13px' }} 
                              />
                              <button 
                                className="btn ghost" 
                                onClick={async () => { 
                                  try { 
                                    const val = (inputEl && inputEl.value) || ''; 
                                    await apiFetch(`/api/admin/users/${u.id}/display-name`, { method: 'PUT', body: JSON.stringify({ displayName: val }) }); 
                                    await loadUsers(); 
                                  } catch (e:any) { setError(e.message) } 
                                }} 
                                style={{ padding: '6px 12px', fontSize: '13px', whiteSpace: 'nowrap' }}
                              >
                                저장
                              </button>
                            </>
                          )
                        })()}
                      </div>
                    </div>
                    
                    <div className="mobile-row-item" style={{ justifyContent: 'center' }}>
                      {!isSuperAdmin && (
                        isAdmin ? (
                          <button className="btn ghost" style={{ width: '100%', fontSize: '13px', whiteSpace: 'nowrap' }} onClick={() => revoke(u.id)}>ADMIN 해제</button>
                        ) : (
                          <button className="btn ghost" style={{ width: '100%', fontSize: '13px', whiteSpace: 'nowrap' }} onClick={() => grant(u.id)}>ADMIN 부여</button>
                        )
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="admin-content">
          {/* 로그 통계 */}
          {logStats && (
            <div className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-value">{logStats.totalLogs}</div>
                <div className="admin-stat-label">총 로그 수</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{logStats.todayLogs}</div>
                <div className="admin-stat-label">오늘 로그 수</div>
              </div>
              <div className="admin-stat-card">
                <div className="admin-stat-value">{logStats.adminUsers}</div>
                <div className="admin-stat-label">활동 관리자 수</div>
              </div>
            </div>
          )}

          {/* 로그 필터 */}
          <div className="admin-controls">
            <div className="admin-filter-group">
              <select
                className="admin-select"
                value={logPagination.size}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value)
                  setLogPagination(prev => ({ ...prev, size: newSize, currentPage: 0 }))
                  loadLogs(0, newSize)
                }}
              >
                <option value="10">10개씩</option>
                <option value="20">20개씩</option>
                <option value="50">50개씩</option>
                <option value="100">100개씩</option>
              </select>

              <input
                className="input"
                placeholder="관리자명"
                value={logFilters.adminUsername}
                onChange={(e) => setLogFilters(prev => ({ ...prev, adminUsername: e.target.value }))}
                style={{ minWidth: 120 }}
              />
              <select
                className="admin-select"
                value={logFilters.entityType}
                onChange={(e) => setLogFilters(prev => ({ ...prev, entityType: e.target.value }))}
              >
                <option value="">모든 엔티티</option>
                <option value="TODO">할일</option>
                <option value="CALENDAR_EVENT">일정</option>
                <option value="NOTICE">공지사항</option>
                <option value="NOTICE_COMMENT">댓글</option>
                <option value="SCENARIO">적재 시뮬레이션</option>
              </select>
              <select
                className="admin-select"
                value={logFilters.action}
                onChange={(e) => setLogFilters(prev => ({ ...prev, action: e.target.value }))}
              >
                <option value="">모든 작업</option>
                <option value="CREATE">생성</option>
                <option value="READ">조회</option>
                <option value="UPDATE">수정</option>
                <option value="DELETE">삭제</option>
              </select>
              <input
                type="date"
                className="input"
                value={logFilters.startDate}
                onChange={(e) => setLogFilters(prev => ({ ...prev, startDate: e.target.value }))}
              />
              <input
                type="date"
                className="input"
                value={logFilters.endDate}
                onChange={(e) => setLogFilters(prev => ({ ...prev, endDate: e.target.value }))}
              />
              <button
                className="btn ghost"
                onClick={() => {
                  setLogFilters({ adminUsername: '', entityType: '', action: '', startDate: '', endDate: '' })
                }}
              >
                초기화
              </button>
            </div>
          </div>

          <div className="admin-table-container">
            {/* 데스크톱 헤더 */}
            <div className="admin-table-header log-grid">
              <div>시간</div>
              <div>관리자</div>
              <div>작업</div>
              <div>내용</div>
              <div>IP 주소</div>
            </div>

            {logsLoading ? (
              <div className="admin-empty-state">로딩 중...</div>
            ) : logs.length === 0 ? (
              <div className="admin-empty-state">로그가 없습니다.</div>
            ) : (
              logs.map((log: AdminLog) => (
                <div key={log.id} className="admin-table-row log-grid">
                  <div className="mobile-row-item">
                    <span className="mobile-label">시간</span>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{log.timestamp}</div>
                  </div>

                  <div className="mobile-row-item">
                    <span className="mobile-label">관리자</span>
                    <div style={{ fontWeight: 600 }}>{log.adminUsername}</div>
                  </div>

                  <div className="mobile-row-item">
                    <span className="mobile-label">작업</span>
                    <div>
                      <span className={`admin-badge ${
                        log.action === 'CREATE' ? 'badge-create' :
                        log.action === 'UPDATE' ? 'badge-update' :
                        log.action === 'DELETE' ? 'badge-delete' : 'badge-read'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-row-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <span className="mobile-label">내용</span>
                    <div>
                      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: 2 }}>
                        {log.entityType} {log.entityId && `(ID: ${log.entityId})`}
                      </div>
                      {log.details && (
                        <div style={{ fontSize: '14px' }}>{log.details}</div>
                      )}
                    </div>
                  </div>

                  <div className="mobile-row-item">
                    <span className="mobile-label">IP</span>
                    <div style={{ fontSize: '13px', color: 'var(--muted)' }}>
                      {log.ipAddress || '-'}
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* 페이지네이션 */}
            {logPagination.totalPages > 1 && (
              <div className="admin-pagination">
                <button
                  className="btn ghost"
                  onClick={() => loadLogs(0)}
                  disabled={logPagination.currentPage === 0 || logsLoading}
                >
                  처음
                </button>
                <button
                  className="btn ghost"
                  onClick={() => loadLogs(logPagination.currentPage - 1)}
                  disabled={logPagination.currentPage === 0 || logsLoading}
                >
                  이전
                </button>

                <span className="pagination-info">
                  {logPagination.currentPage + 1} / {logPagination.totalPages} 페이지
                  ({logPagination.totalElements}개 항목)
                </span>

                <button
                  className="btn ghost"
                  onClick={() => loadLogs(logPagination.currentPage + 1)}
                  disabled={logPagination.currentPage >= logPagination.totalPages - 1 || logsLoading}
                >
                  다음
                </button>
                <button
                  className="btn ghost"
                  onClick={() => loadLogs(logPagination.totalPages - 1)}
                  disabled={logPagination.currentPage >= logPagination.totalPages - 1 || logsLoading}
                >
                  마지막
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
