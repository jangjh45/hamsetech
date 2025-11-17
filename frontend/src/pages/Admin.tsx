import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { getUsername as getMe, getToken, getRoles, saveAuth, onTokenExpired } from '../auth/token'

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
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)
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

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
    <div className="container" style={{
      display: 'flex',
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{
        maxWidth: 1200,
        width: '100%',
        margin: '16px auto 32px',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <div style={{ marginBottom: 12 }}>
          <h1 className="title" style={{ marginBottom: 6, textAlign: 'center' }}>관리자</h1>
          <p className="subtitle" style={{ textAlign: 'center' }}>ADMIN 권한이 있어야 접근할 수 있습니다</p>
        </div>

        {/* 탭 메뉴 */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: 24
        }}>
          <button
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'users' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'users' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'users' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            사용자 관리
          </button>
          <button
            className={`tab-button ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: 'none',
              borderBottom: activeTab === 'logs' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeTab === 'logs' ? 'var(--primary)' : 'var(--muted)',
              fontWeight: activeTab === 'logs' ? 'bold' : 'normal',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            활동 로그
          </button>
        </div>
        {tokenExpired && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '8px',
            marginBottom: '16px',
            color: '#dc2626'
          }}>
            <strong>세션 만료 알림</strong><br />
            로그인 세션이 만료되었습니다. 잠시 후 로그인 페이지로 이동됩니다.
          </div>
        )}
        {error ? <p className="error" style={{ textAlign: 'center' }}>{error}</p> : <p className="subtitle" style={{ marginTop: 0, textAlign: 'center' }}>{msg}</p>}

        {activeTab === 'users' && (
          <>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 16,
              marginBottom: 12,
              flexDirection: isMobile ? 'column' : 'row'
            }}>
              <input
                className="input"
                placeholder="사용자 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                style={{ flex: 1, width: isMobile ? '100%' : 'auto', minWidth: 0 }}
              />
              <button className="btn ghost" onClick={() => loadUsers(q)} style={{ whiteSpace: 'nowrap', flex: '0 0 auto' }}>검색</button>
            </div>
          </>
        )}

        {activeTab === 'logs' && (
          <>
            {/* 로그 통계 */}
            {logStats && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>{logStats.totalLogs}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>총 로그 수</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>{logStats.todayLogs}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>오늘 로그 수</div>
                </div>
                <div className="card" style={{ flex: 1, minWidth: 120, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--primary)' }}>{logStats.adminUsers}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>활동 관리자 수</div>
                </div>
              </div>
            )}

            {/* 로그 필터 */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <select
                className="input"
                value={logPagination.size}
                onChange={(e) => {
                  const newSize = parseInt(e.target.value)
                  setLogPagination(prev => ({ ...prev, size: newSize, currentPage: 0 }))
                  loadLogs(0, newSize) // 페이지 크기 변경 시 첫 페이지로 이동
                }}
                style={{ flex: '0 0 auto', minWidth: 100 }}
              >
                <option value="10">10개씩</option>
                <option value="20">20개씩</option>
                <option value="50">50개씩</option>
                <option value="100">100개씩</option>
              </select>
            </div>

            {/* 로그 필터 */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginBottom: 12,
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              <input
                className="input"
                placeholder="관리자명"
                value={logFilters.adminUsername}
                onChange={(e) => setLogFilters(prev => ({ ...prev, adminUsername: e.target.value }))}
                style={{ flex: 1, minWidth: 120 }}
              />
              <select
                className="input"
                value={logFilters.entityType}
                onChange={(e) => setLogFilters(prev => ({ ...prev, entityType: e.target.value }))}
                style={{ flex: 1, minWidth: 120 }}
              >
                <option value="">모든 엔티티</option>
                <option value="TODO">할일</option>
                <option value="CALENDAR_EVENT">일정</option>
                <option value="NOTICE">공지사항</option>
                <option value="NOTICE_COMMENT">댓글</option>
                <option value="SCENARIO">적재 시뮬레이션</option>
              </select>
              <select
                className="input"
                value={logFilters.action}
                onChange={(e) => setLogFilters(prev => ({ ...prev, action: e.target.value }))}
                style={{ flex: 1, minWidth: 120 }}
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
                style={{ flex: 1, minWidth: 120 }}
              />
              <input
                type="date"
                className="input"
                value={logFilters.endDate}
                onChange={(e) => setLogFilters(prev => ({ ...prev, endDate: e.target.value }))}
                style={{ flex: 1, minWidth: 120 }}
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
          </>
        )}

        {activeTab === 'users' && (
          <div className="card" style={{ padding: 0 }}>
            {isMobile ? (
              // 모바일 레이아웃
              <>
                {users.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>사용자가 없습니다.</div>
                )}
                {users.map((u: any, index: number) => {
                  const roles = u.roles || []
                  const isAdmin = roles.includes('ADMIN')
                  const isSuperAdmin = roles.includes('SUPER_ADMIN')
                  const isLastItem = index === users.length - 1
                  return (
                    <div key={u.id} style={{
                      padding: '16px',
                      borderBottom: isLastItem ? 'none' : '1px solid var(--border)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{
                          color: 'var(--muted)',
                          fontSize: '12px'
                        }}>ID: {u.id}</span>
                        <span style={{
                          color: 'var(--muted)',
                          fontSize: '12px'
                        }}>{roles.join(', ')}</span>
                      </div>
                      <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                        {u.username}{u.displayName ? ` (${u.displayName})` : ''}
                      </div>
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}>
                        <div style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexDirection: 'column'
                        }}>
                          {(() => {
                            let inputEl: HTMLInputElement | null = null;
                            return (
                              <>
                                <input
                                  ref={(el) => { inputEl = el }}
                                  className="input"
                                  placeholder="이름/닉네임"
                                  defaultValue={u.displayName || ''}
                                  style={{ width: '100%' }}
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
                                  style={{ width: '100%' }}
                                >
                                  이름 저장
                                </button>
                              </>
                            )
                          })()}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>
                          {!isSuperAdmin && (
                            isAdmin ? (
                              <button className="btn ghost" style={{ width: '100%' }} onClick={() => revoke(u.id)}>ADMIN 해제</button>
                            ) : (
                              <button className="btn ghost" style={{ width: '100%' }} onClick={() => grant(u.id)}>ADMIN 부여</button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </>
            ) : (
              // 데스크톱 레이아웃
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 150px 100px', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 14 }}>
                  <div style={{ textAlign: 'center' }}>ID</div>
                  <div>사용자명</div>
                  <div>역할</div>
                  <div style={{ textAlign: 'center' }}>이름/닉네임 관리</div>
                  <div style={{ textAlign: 'center' }}>권한</div>
                </div>
                {users.length === 0 && (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>사용자가 없습니다.</div>
                )}
                {users.map((u: any, index: number) => {
                  const roles = u.roles || []
                  const isAdmin = roles.includes('ADMIN')
                  const isSuperAdmin = roles.includes('SUPER_ADMIN')
                  const isLastItem = index === users.length - 1
                  return (
                    <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '50px 1fr 100px 150px 100px', alignItems: 'center', gap: 8, padding: '8px 12px', height: 40, borderBottom: isLastItem ? 'none' : '1px solid var(--border)', overflow: 'hidden' }}>
                      <div style={{ textAlign: 'center', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{u.id}</div>
                      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{u.username}{u.displayName ? ` (${u.displayName})` : ''}</div>
                      <div style={{ color: 'var(--muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontSize: '12px' }} title={(roles || []).join(', ')}>{roles.join(', ')}</div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', minWidth: 0 }}>
                        {(() => {
                          let inputEl: HTMLInputElement | null = null;
                          return (
                            <>
                              <input ref={(el) => { inputEl = el }} className="input" placeholder="이름/닉네임" defaultValue={u.displayName || ''} style={{ flex: 1, minWidth: 0, padding: '6px 10px', fontSize: '12px' }} />
                              <button className="btn ghost" onClick={async () => { try { const val = (inputEl && inputEl.value) || ''; await apiFetch(`/api/admin/users/${u.id}/display-name`, { method: 'PUT', body: JSON.stringify({ displayName: val }) }); await loadUsers(); } catch (e:any) { setError(e.message) } }} style={{ padding: '6px 10px', fontSize: '12px', whiteSpace: 'nowrap', flex: '0 0 auto' }}>저장</button>
                            </>
                          )
                        })()}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {!isSuperAdmin && (
                          isAdmin ? (
                            <button className="btn ghost" style={{ padding: '6px 8px', fontSize: '12px', whiteSpace: 'nowrap' }} onClick={() => revoke(u.id)}>ADMIN 해제</button>
                          ) : (
                            <button className="btn ghost" style={{ padding: '6px 8px', fontSize: '12px', whiteSpace: 'nowrap' }} onClick={() => grant(u.id)}>ADMIN 부여</button>
                          )
                        )}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="card" style={{ padding: 0 }}>
            {logsLoading ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>로딩 중...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>로그가 없습니다.</div>
            ) : (
              <>
                {isMobile ? (
                  // 모바일 로그 레이아웃
                  logs.map((log: AdminLog, index: number) => {
                    const isLastItem = index === logs.length - 1
                    return (
                      <div key={log.id} style={{
                        padding: '16px',
                        borderBottom: isLastItem ? 'none' : '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{log.timestamp}</span>
                          <span style={{
                            fontSize: '12px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: log.action === 'CREATE' ? '#dcfce7' :
                                           log.action === 'UPDATE' ? '#fef3c7' :
                                           log.action === 'DELETE' ? '#fee2e2' : '#f3f4f6',
                            color: log.action === 'CREATE' ? '#166534' :
                                   log.action === 'UPDATE' ? '#92400e' :
                                   log.action === 'DELETE' ? '#dc2626' : '#374151'
                          }}>
                            {log.action}
                          </span>
                        </div>
                        <div style={{ fontWeight: 'bold' }}>{log.adminUsername}</div>
                        <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
                          {log.entityType} {log.entityId && `(ID: ${log.entityId})`}
                        </div>
                        {log.details && (
                          <div style={{ fontSize: '14px', marginTop: 4 }}>{log.details}</div>
                        )}
                        {log.ipAddress && (
                          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: 4 }}>
                            IP: {log.ipAddress}
                          </div>
                        )}
                      </div>
                    )
                  })
                ) : (
                  // 데스크톱 로그 레이아웃
                  <>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '140px 120px 100px 1fr 120px',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 12px',
                      height: 40,
                      borderBottom: '1px solid var(--border)',
                      color: 'var(--muted)',
                      fontSize: 14
                    }}>
                      <div>시간</div>
                      <div>관리자</div>
                      <div>작업</div>
                      <div>내용</div>
                      <div>IP 주소</div>
                    </div>
                    {logs.map((log: AdminLog, index: number) => {
                      const isLastItem = index === logs.length - 1
                      return (
                        <div key={log.id} style={{
                          display: 'grid',
                          gridTemplateColumns: '140px 120px 100px 1fr 120px',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 12px',
                          borderBottom: isLastItem ? 'none' : '1px solid var(--border)',
                          fontSize: '14px'
                        }}>
                          <div style={{ fontSize: '12px' }}>{log.timestamp}</div>
                          <div style={{ fontWeight: 'bold', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {log.adminUsername}
                          </div>
                          <div>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '12px',
                              backgroundColor: log.action === 'CREATE' ? '#dcfce7' :
                                             log.action === 'UPDATE' ? '#fef3c7' :
                                             log.action === 'DELETE' ? '#fee2e2' : '#f3f4f6',
                              color: log.action === 'CREATE' ? '#166534' :
                                     log.action === 'UPDATE' ? '#92400e' :
                                     log.action === 'DELETE' ? '#dc2626' : '#374151'
                            }}>
                              {log.action}
                            </span>
                          </div>
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: 2 }}>
                              {log.entityType} {log.entityId && `(ID: ${log.entityId})`}
                            </div>
                            {log.details && (
                              <div style={{ fontSize: '13px' }}>{log.details}</div>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                            {log.ipAddress || '-'}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </>
            )}

            {/* 페이지네이션 */}
            {logPagination.totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 16,
                marginTop: 16,
                padding: '12px 0',
                borderTop: '1px solid var(--border)'
              }}>
                <button
                  className="btn ghost"
                  onClick={() => loadLogs(0)}
                  disabled={logPagination.currentPage === 0 || logsLoading}
                  style={{ padding: '8px 12px' }}
                >
                  처음
                </button>
                <button
                  className="btn ghost"
                  onClick={() => loadLogs(logPagination.currentPage - 1)}
                  disabled={logPagination.currentPage === 0 || logsLoading}
                  style={{ padding: '8px 12px' }}
                >
                  이전
                </button>

                <span style={{
                  color: 'var(--muted)',
                  fontSize: '14px',
                  minWidth: '120px',
                  textAlign: 'center'
                }}>
                  {logPagination.currentPage + 1} / {logPagination.totalPages} 페이지
                  ({logPagination.totalElements}개 항목)
                </span>

                <button
                  className="btn ghost"
                  onClick={() => loadLogs(logPagination.currentPage + 1)}
                  disabled={logPagination.currentPage >= logPagination.totalPages - 1 || logsLoading}
                  style={{ padding: '8px 12px' }}
                >
                  다음
                </button>
                <button
                  className="btn ghost"
                  onClick={() => loadLogs(logPagination.totalPages - 1)}
                  disabled={logPagination.currentPage >= logPagination.totalPages - 1 || logsLoading}
                  style={{ padding: '8px 12px' }}
                >
                  마지막
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}


