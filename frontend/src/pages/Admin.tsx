import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { getUsername as getMe, getToken, getRoles, saveAuth, onTokenExpired } from '../auth/token'
import {
  listAllOvertimeRecords,
  approveOvertimeRecord,
  rejectOvertimeRecord,
  deleteOvertimeRecord,
  getOvertimeSummary,
  getOvertimeDefaults,
  updateOvertimeDefaults,
  type OvertimeRecord,
  type OvertimeSummary,
  type OvertimeDefaults,
} from '../api/overtimeRecords'
import { formatTime } from '../utils/formatDate'
import Pager from '../components/Pager'
import '../styles/admin.css'
import '../styles/overtime.css'

const OVERTIME_STATUS_LABEL: Record<string, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const OVERTIME_STATUS_TONE: Record<string, string> = {
  PENDING: 'fl-tone-warn',
  APPROVED: 'fl-tone-success',
  REJECTED: 'fl-tone-danger',
}
const OVERTIME_TYPE_LABEL: Record<string, string> = { OVERTIME: '잔업', SPECIAL: '특근' }
const LOG_ACTION_TONE: Record<string, string> = {
  CREATE: 'fl-tone-success',
  UPDATE: 'fl-tone-warn',
  DELETE: 'fl-tone-danger',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** '2026-08-14' → '08.14 (금)' */
function formatWorkDate(ymd: string): string {
  const [y, m, d] = (ymd || '').split('-').map(Number)
  if (!y || !m || !d) return ymd
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

/** 목록 표의 근무시간 한 줄 */
function workTimeText(r: OvertimeRecord): string {
  if (r.startTime && r.endTime) {
    const h = Math.floor(r.totalMinutes / 60)
    const m = r.totalMinutes % 60
    return `${formatTime(r.startTime)}–${formatTime(r.endTime)} · ${h}h${m > 0 ? `${m}m` : ''}`
  }
  return `총 ${r.totalMinutes}분`
}

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
  const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'overtime'>('users')
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([])
  const [overtimeLoading, setOvertimeLoading] = useState(false)
  const [overtimeSummary, setOvertimeSummary] = useState<OvertimeSummary[]>([])
  const [overtimeFilters, setOvertimeFilters] = useState({ username: '', type: '', status: '' })
  const [overtimePagination, setOvertimePagination] = useState({ currentPage: 0, totalPages: 0, totalElements: 0, size: 20 })
  const [overtimeMonth, setOvertimeMonth] = useState<string>(() => new Date().toISOString().slice(0, 7))
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [overtimeDefaults, setOvertimeDefaults] = useState<OvertimeDefaults | null>(null)
  const [defaultsSaving, setDefaultsSaving] = useState(false)
  const [defaultsMsg, setDefaultsMsg] = useState('')
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

  async function loadOvertimeRecords(page: number = 0) {
    try {
      setOvertimeLoading(true)
      const result = await listAllOvertimeRecords({
        username: overtimeFilters.username || undefined,
        type: (overtimeFilters.type || undefined) as any,
        status: (overtimeFilters.status || undefined) as any,
        page,
        size: overtimePagination.size,
      })
      setOvertimeRecords(result.content)
      setOvertimePagination(prev => ({
        ...prev,
        currentPage: result.number ?? 0,
        totalPages: result.totalPages ?? 0,
        totalElements: result.totalElements ?? 0,
        size: result.size ?? prev.size,
      }))
    } catch (e: any) {
      setError(e.message || '잔업/특근 기록 로드 실패')
    } finally {
      setOvertimeLoading(false)
    }
  }

  async function loadOvertimeSummary() {
    try {
      const summary = await getOvertimeSummary(overtimeMonth)
      setOvertimeSummary(summary)
    } catch (e: any) {
      setError(e.message || '월별 집계 로드 실패')
    }
  }

  async function loadOvertimeDefaults() {
    try {
      const d = await getOvertimeDefaults()
      setOvertimeDefaults(d)
    } catch (e: any) {
      setError(e.message || '기본 근무시간 로드 실패')
    }
  }

  async function saveOvertimeDefaults() {
    if (!overtimeDefaults) return
    setDefaultsSaving(true)
    setDefaultsMsg('')
    try {
      const saved = await updateOvertimeDefaults(overtimeDefaults)
      setOvertimeDefaults(saved)
      setDefaultsMsg('저장되었습니다.')
    } catch (e: any) {
      setError(e.message || '기본 근무시간 저장 실패')
    } finally {
      setDefaultsSaving(false)
    }
  }

  async function approveOvertime(id: number) {
    try {
      await approveOvertimeRecord(id)
      await Promise.all([loadOvertimeRecords(overtimePagination.currentPage), loadOvertimeSummary()])
    } catch (e: any) {
      setError(e.message || '승인 실패')
    }
  }

  async function rejectOvertime(id: number) {
    try {
      await rejectOvertimeRecord(id, rejectReason)
      setRejectingId(null)
      setRejectReason('')
      await loadOvertimeRecords(overtimePagination.currentPage)
    } catch (e: any) {
      setError(e.message || '반려 실패')
    }
  }

  async function deleteOvertime(id: number) {
    if (!window.confirm('이 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.')) return
    try {
      await deleteOvertimeRecord(id)
      // 마지막 페이지의 마지막 항목을 지우면 빈 페이지가 되므로, 필요 시 이전 페이지로 이동
      const isLastItemOnPage = overtimeRecords.length === 1 && overtimePagination.currentPage > 0
      const target = isLastItemOnPage ? overtimePagination.currentPage - 1 : overtimePagination.currentPage
      await Promise.all([loadOvertimeRecords(target), loadOvertimeSummary()])
    } catch (e: any) {
      setError(e.message || '삭제 실패')
    }
  }

  useEffect(() => { loadUsers('') }, [])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(0) // 탭 변경 시 첫 페이지로 이동
      loadLogStats()
    }
    if (activeTab === 'overtime') {
      loadOvertimeRecords(0)
      loadOvertimeSummary()
      loadOvertimeDefaults()
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(0) // 필터 변경 시 첫 페이지로 이동
    }
  }, [logFilters])

  useEffect(() => {
    if (activeTab === 'overtime') {
      loadOvertimeRecords(0) // 필터 변경 시 첫 페이지로
    }
  }, [overtimeFilters])

  useEffect(() => {
    if (activeTab === 'overtime') {
      loadOvertimeSummary()
    }
  }, [overtimeMonth])

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
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>관리자</h1>
          <p>{msg}</p>
        </div>
        <div className="fl-seg">
          <button
            className={`fl-seg-btn${activeTab === 'users' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            사용자
          </button>
          <button
            className={`fl-seg-btn${activeTab === 'logs' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            로그
          </button>
          <button
            className={`fl-seg-btn${activeTab === 'overtime' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('overtime')}
          >
            잔업특근
          </button>
        </div>
      </div>

      {tokenExpired && (
        <div className="fl-error" style={{ marginBottom: 16 }}>
          세션이 만료되었습니다. 잠시 후 로그인 페이지로 이동됩니다.
        </div>
      )}

      {error && (
        <div className="fl-error" style={{ marginBottom: 16 }}>
          {error}
        </div>
      )}

      {activeTab === 'users' && (
        <section className="fl-card">
          <div className="fl-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="fl-card-title">사용자</span>
              <span className="fl-card-count">총 {users.length}명</span>
            </div>
            <div className="ad-filters ad-search">
              <input
                className="fl-input"
                placeholder="사번 · 이름 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers(q)}
              />
              <button className="fl-btn" onClick={() => loadUsers(q)}>
                검색
              </button>
            </div>
          </div>

          <div className="fl-card-body fl-flush">
            <div className="fl-th ad-user-head">
              <div>ID</div>
              <div>사용자</div>
              <div>역할</div>
              <div>이름/닉네임</div>
              <div style={{ textAlign: 'right' }}>권한</div>
            </div>

            {users.length === 0 ? (
              <div className="fl-empty">사용자가 없습니다.</div>
            ) : (
              users.map((u: any) => {
                const roles: string[] = u.roles || []
                const isAdmin = roles.includes('ADMIN')
                const isSuperAdmin = roles.includes('SUPER_ADMIN')

                return (
                  <div key={u.id} className="fl-tr ad-user-row">
                    <span className="fl-cell-num">
                      <span className="ad-label">ID</span>
                      {u.id}
                    </span>

                    <span className="ad-user-name">
                      <span className="ad-label">사용자</span>
                      <span className="fl-avatar fl-avatar-sm" style={{ marginRight: 8 }}>
                        {(u.displayName || u.username || '?').charAt(0)}
                      </span>
                      {u.username}
                      {u.displayName ? ` (${u.displayName})` : ''}
                    </span>

                    <span className="ad-user-roles">
                      <span className="ad-label">역할</span>
                      {roles.join(', ')}
                    </span>

                    <span>
                      <span className="ad-label">이름/닉네임</span>
                      <DisplayNameEditor
                        initial={u.displayName || ''}
                        onSave={async (value) => {
                          try {
                            await apiFetch(`/api/admin/users/${u.id}/display-name`, {
                              method: 'PUT',
                              body: JSON.stringify({ displayName: value }),
                            })
                            await loadUsers()
                          } catch (e: any) {
                            setError(e.message)
                          }
                        }}
                      />
                    </span>

                    <span className="fl-cell-actions">
                      {isSuperAdmin ? (
                        <span className="fl-badge fl-tone-primary">SUPER</span>
                      ) : isAdmin ? (
                        <button className="fl-btn fl-btn-sm" onClick={() => revoke(u.id)}>
                          ADMIN 해제
                        </button>
                      ) : (
                        <button className="fl-btn fl-btn-sm" onClick={() => grant(u.id)}>
                          ADMIN 부여
                        </button>
                      )}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'logs' && (
        <>
          {logStats && (
            <div className="fl-stat-grid ad-stat-grid">
              <div className="fl-stat">
                <div className="fl-stat-label">총 로그 수</div>
                <div className="fl-stat-value">
                  <span className="fl-stat-num">{logStats.totalLogs}</span>
                  <span className="fl-stat-unit">건</span>
                </div>
              </div>
              <div className="fl-stat">
                <div className="fl-stat-label">오늘 로그 수</div>
                <div className="fl-stat-value">
                  <span className="fl-stat-num">{logStats.todayLogs}</span>
                  <span className="fl-stat-unit">건</span>
                </div>
              </div>
              <div className="fl-stat">
                <div className="fl-stat-label">활동 관리자 수</div>
                <div className="fl-stat-value">
                  <span className="fl-stat-num">{logStats.adminUsers}</span>
                  <span className="fl-stat-unit">명</span>
                </div>
              </div>
            </div>
          )}

          <section className="fl-card">
            <div className="fl-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="fl-card-title">활동 로그</span>
                <span className="fl-card-count">총 {logPagination.totalElements}건</span>
              </div>
              <div className="ad-filters">
                <input
                  className="fl-input"
                  placeholder="관리자명"
                  value={logFilters.adminUsername}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, adminUsername: e.target.value }))}
                  style={{ width: 130 }}
                />
                <select
                  className="fl-input"
                  value={logFilters.entityType}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, entityType: e.target.value }))}
                  aria-label="엔티티 필터"
                >
                  <option value="">모든 엔티티</option>
                  <option value="TODO">할일</option>
                  <option value="CALENDAR_EVENT">일정</option>
                  <option value="NOTICE">공지사항</option>
                  <option value="NOTICE_COMMENT">댓글</option>
                  <option value="SCENARIO">적재 시뮬레이션</option>
                </select>
                <select
                  className="fl-input"
                  value={logFilters.action}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, action: e.target.value }))}
                  aria-label="작업 필터"
                >
                  <option value="">모든 작업</option>
                  <option value="CREATE">생성</option>
                  <option value="READ">조회</option>
                  <option value="UPDATE">수정</option>
                  <option value="DELETE">삭제</option>
                </select>
                <input
                  type="date"
                  className="fl-input"
                  value={logFilters.startDate}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  aria-label="시작일"
                />
                <input
                  type="date"
                  className="fl-input"
                  value={logFilters.endDate}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  aria-label="종료일"
                />
                <select
                  className="fl-input"
                  value={logPagination.size}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value)
                    setLogPagination((prev) => ({ ...prev, size: newSize, currentPage: 0 }))
                    loadLogs(0, newSize)
                  }}
                  aria-label="페이지당 항목 수"
                >
                  <option value="10">10개씩</option>
                  <option value="20">20개씩</option>
                  <option value="50">50개씩</option>
                  <option value="100">100개씩</option>
                </select>
                <button
                  className="fl-btn"
                  onClick={() =>
                    setLogFilters({ adminUsername: '', entityType: '', action: '', startDate: '', endDate: '' })
                  }
                >
                  초기화
                </button>
              </div>
            </div>

            <div className="fl-card-body fl-flush">
              <div className="fl-th ad-log-head">
                <div>시간</div>
                <div>관리자</div>
                <div>작업</div>
                <div>내용</div>
                <div>IP 주소</div>
              </div>

              {logsLoading ? (
                <div className="fl-empty">불러오는 중...</div>
              ) : logs.length === 0 ? (
                <div className="fl-empty">로그가 없습니다.</div>
              ) : (
                logs.map((log: AdminLog) => (
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
                      <span
                        className={`fl-badge fl-badge-square ${LOG_ACTION_TONE[log.action] || ''}`}
                      >
                        {log.action}
                      </span>
                    </span>

                    <span className="ad-log-detail">
                      <span className="ad-label">내용</span>
                      <span className="ad-log-entity">
                        {log.entityType} {log.entityId != null && `(ID: ${log.entityId})`}
                      </span>
                      {log.details && <span className="ad-log-text">{log.details}</span>}
                    </span>

                    <span className="ad-log-ip">
                      <span className="ad-label">IP</span>
                      {log.ipAddress || '-'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Pager
              page={logPagination.currentPage}
              totalPages={logPagination.totalPages}
              onChange={loadLogs}
              disabled={logsLoading}
            />
          </section>
        </>
      )}

      {activeTab === 'overtime' && (
        <div className="ot-admin-grid">
          <section className="fl-card">
            <div className="fl-card-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="fl-card-title">승인 요청</span>
                <span className="fl-card-count">총 {overtimePagination.totalElements}건</span>
              </div>
              <div className="ad-filters">
                <div className="fl-seg">
                  {(
                    [
                      ['PENDING', '대기'],
                      ['APPROVED', '승인'],
                      ['REJECTED', '반려'],
                      ['', '전체'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={label}
                      className={`fl-seg-btn${overtimeFilters.status === value ? ' is-active' : ''}${
                        value === 'PENDING' ? ' fl-tone-warn' : ''
                      }`}
                      onClick={() => setOvertimeFilters((prev) => ({ ...prev, status: value }))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <select
                  className="fl-input"
                  value={overtimeFilters.type}
                  onChange={(e) => setOvertimeFilters((prev) => ({ ...prev, type: e.target.value }))}
                  aria-label="구분 필터"
                >
                  <option value="">구분 전체</option>
                  <option value="OVERTIME">잔업</option>
                  <option value="SPECIAL">특근</option>
                </select>
                <input
                  className="fl-input"
                  placeholder="사번 · 이름 검색"
                  value={overtimeFilters.username}
                  onChange={(e) => setOvertimeFilters((prev) => ({ ...prev, username: e.target.value }))}
                  style={{ width: 170 }}
                />
              </div>
            </div>

            <div className="fl-card-body fl-flush">
              <div className="fl-th ot-approve-head">
                <div>직원</div>
                <div>근무일</div>
                <div>구분</div>
                <div>시간</div>
                <div>사유</div>
                <div style={{ textAlign: 'right' }}>처리</div>
              </div>

              {overtimeLoading ? (
                <div className="fl-empty">불러오는 중...</div>
              ) : overtimeRecords.length === 0 ? (
                <div className="fl-empty">조건에 맞는 기록이 없습니다.</div>
              ) : (
                overtimeRecords.map((r) => (
                  <div
                    key={r.id}
                    className={`fl-tr ot-approve-row${rejectingId === r.id ? ' is-open' : ''}`}
                  >
                    <span className="ot-person">
                      <span className="fl-avatar fl-avatar-sm">
                        {(r.displayName || r.username || '?').charAt(0)}
                      </span>
                      <span className="ot-person-name">{r.displayName || r.username}</span>
                    </span>

                    <span className="ot-row-date">{formatWorkDate(r.workDate)}</span>

                    <span
                      className={`fl-badge fl-badge-square ot-badge-type ${
                        r.type === 'SPECIAL' ? 'fl-tone-special' : 'fl-tone-primary'
                      }`}
                    >
                      {OVERTIME_TYPE_LABEL[r.type]}
                    </span>

                    <span className="ot-row-time">{workTimeText(r)}</span>

                    <span className="ot-row-reason">
                      <span className={`ot-row-reason-text${r.reason ? '' : ' is-empty'}`}>
                        {r.reason || '—'}
                      </span>
                      {r.status === 'REJECTED' && r.rejectReason && (
                        <span className="ot-reject-note">반려 사유 — {r.rejectReason}</span>
                      )}
                    </span>

                    <span className="fl-cell-actions ot-row-actions">
                      {rejectingId === r.id ? (
                        <button
                          className="fl-btn fl-btn-sm"
                          onClick={() => {
                            setRejectingId(null)
                            setRejectReason('')
                          }}
                        >
                          취소
                        </button>
                      ) : r.status === 'PENDING' ? (
                        <>
                          <button
                            className="fl-btn fl-btn-sm fl-btn-primary"
                            onClick={() => approveOvertime(r.id)}
                          >
                            승인
                          </button>
                          <button className="fl-btn fl-btn-sm" onClick={() => setRejectingId(r.id)}>
                            반려
                          </button>
                        </>
                      ) : (
                        <span className={`fl-badge ot-badge-status ${OVERTIME_STATUS_TONE[r.status]}`}>
                          {OVERTIME_STATUS_LABEL[r.status]}
                        </span>
                      )}
                      <button
                        className="fl-btn-x"
                        onClick={() => deleteOvertime(r.id)}
                        title="삭제"
                        aria-label="삭제"
                      >
                        ×
                      </button>
                    </span>

                    {rejectingId === r.id && (
                      <div className="ot-reject-inline">
                        <input
                          className="fl-input"
                          placeholder="반려 사유를 입력하세요"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && rejectOvertime(r.id)}
                          autoFocus
                        />
                        <button
                          className="fl-btn fl-btn-danger-solid"
                          onClick={() => rejectOvertime(r.id)}
                        >
                          반려 확정
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <Pager
              page={overtimePagination.currentPage}
              totalPages={overtimePagination.totalPages}
              onChange={loadOvertimeRecords}
              disabled={overtimeLoading}
            />
          </section>

          <div className="ot-admin-side">
            {/* 기본 근무시간 설정 — 직원 등록 폼의 시작·종료 시간이 여기서 채워진다 */}
            <section className="fl-card">
              <div className="fl-card-head fl-plain">
                <span className="fl-card-title">기본 근무시간</span>
              </div>
              <div className="fl-card-body">
                {overtimeDefaults ? (
                  <>
                    <div className="fl-field">
                      <span className="ot-defaults-label">
                        <span className="fl-badge fl-badge-square fl-tone-primary">잔업</span>
                        평일 연장
                      </span>
                      <div className="fl-range">
                        <input
                          type="time"
                          className="fl-input"
                          value={formatTime(overtimeDefaults.overtimeStart)}
                          onChange={(e) =>
                            setOvertimeDefaults({ ...overtimeDefaults, overtimeStart: e.target.value })
                          }
                          aria-label="잔업 시작 시간"
                        />
                        <span className="fl-range-sep">–</span>
                        <input
                          type="time"
                          className="fl-input"
                          value={formatTime(overtimeDefaults.overtimeEnd)}
                          onChange={(e) =>
                            setOvertimeDefaults({ ...overtimeDefaults, overtimeEnd: e.target.value })
                          }
                          aria-label="잔업 종료 시간"
                        />
                      </div>
                    </div>

                    <div className="fl-field">
                      <span className="ot-defaults-label">
                        <span className="fl-badge fl-badge-square fl-tone-special">특근</span>
                        휴일 · 주말
                      </span>
                      <div className="fl-range">
                        <input
                          type="time"
                          className="fl-input"
                          value={formatTime(overtimeDefaults.specialStart)}
                          onChange={(e) =>
                            setOvertimeDefaults({ ...overtimeDefaults, specialStart: e.target.value })
                          }
                          aria-label="특근 시작 시간"
                        />
                        <span className="fl-range-sep">–</span>
                        <input
                          type="time"
                          className="fl-input"
                          value={formatTime(overtimeDefaults.specialEnd)}
                          onChange={(e) =>
                            setOvertimeDefaults({ ...overtimeDefaults, specialEnd: e.target.value })
                          }
                          aria-label="특근 종료 시간"
                        />
                      </div>
                    </div>

                    <div className="fl-hint">
                      특근은 6시간 이상 근무 시 점심 휴게시간 1시간이 총 근무시간에서 자동 차감됩니다.
                    </div>

                    <button className="fl-btn" onClick={saveOvertimeDefaults} disabled={defaultsSaving}>
                      {defaultsSaving ? '저장 중...' : '저장'}
                    </button>
                    {defaultsMsg && <div className="fl-stat-sub">{defaultsMsg}</div>}
                  </>
                ) : (
                  <div className="fl-empty">기본 근무시간을 불러오는 중...</div>
                )}
              </div>
            </section>

            {/* 월별 집계 — 승인된 기록만 집계된다 */}
            <section className="fl-card">
              <div className="fl-card-head">
                <span className="fl-card-title">월별 집계</span>
                <input
                  type="month"
                  className="fl-input"
                  value={overtimeMonth}
                  onChange={(e) => e.target.value && setOvertimeMonth(e.target.value)}
                  style={{ width: 150 }}
                  aria-label="집계 월"
                />
              </div>

              <div className="fl-card-body fl-flush">
                <div className="fl-th ot-sum-head">
                  <div>직원</div>
                  <div style={{ textAlign: 'right' }}>잔업</div>
                  <div style={{ textAlign: 'right' }}>특근</div>
                </div>

                {overtimeSummary.length === 0 ? (
                  <div className="fl-empty">승인된 기록이 없습니다.</div>
                ) : (
                  overtimeSummary.map((s) => (
                    <div key={s.username} className="fl-tr ot-sum-row">
                      <span className="ot-sum-name">{s.displayName || s.username}</span>
                      <span className="ot-sum-num">
                        {(s.overtimeMinutes / 60).toFixed(1)}h
                        <span className="ot-sum-days">{s.overtimeDays}일</span>
                      </span>
                      <span className="ot-sum-num">
                        {(s.specialMinutes / 60).toFixed(1)}h
                        <span className="ot-sum-days">{s.specialDays}일</span>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * 닉네임 인라인 편집.
 * 목록이 다시 로드돼도 방금 친 값이 남지 않도록 서버 값(initial)이 바뀌면 입력도 따라간다.
 */
function DisplayNameEditor({
  initial,
  onSave,
}: {
  initial: string
  onSave: (value: string) => Promise<void>
}) {
  const [value, setValue] = useState(initial)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setValue(initial)
  }, [initial])

  async function save() {
    setSaving(true)
    try {
      await onSave(value)
    } finally {
      setSaving(false)
    }
  }

  return (
    <span className="ad-name-edit">
      <input
        className="fl-input"
        placeholder="이름/닉네임"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button className="fl-btn fl-btn-sm" onClick={save} disabled={saving || value === initial}>
        저장
      </button>
    </span>
  )
}
