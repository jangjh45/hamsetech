import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { getUsername as getMe, getToken, getRoles, saveAuth, onTokenExpired } from '../auth/token'
import {
  listAllOvertimeRecords,
  approveOvertimeRecord,
  rejectOvertimeRecord,
  deleteOvertimeRecord,
  createOvertimeRecordsBulk,
  getOvertimeSummary,
  getOvertimeDefaults,
  updateOvertimeDefaults,
  downloadOvertimeExcel,
  type OvertimeRecord,
  type OvertimeSummary,
  type OvertimeDefaults,
  type OvertimeBulkResult,
  type OvertimeType,
} from '../api/overtimeRecords'
import { formatMinutes, formatTime, payrollCycle, toYmd } from '../utils/formatDate'
import { defaultTimesFor, durationOf } from '../utils/overtime'
import Pager from '../components/Pager'
import { KeyIcon, UserMinusIcon } from '../components/AdminIcons'
import '../styles/admin.css'
import '../styles/overtime.css'

// APPROVED는 정상 상태라 배지를 달지 않는다(undefined면 렌더하지 않음)
const USER_STATUS_BADGE: Record<string, { label: string; tone: string }> = {
  PENDING: { label: '승인 대기', tone: 'fl-tone-warn' },
  REJECTED: { label: '거절됨', tone: 'fl-tone-danger' },
  WITHDRAW_REQUESTED: { label: '탈퇴 신청', tone: 'fl-tone-warn' },
  WITHDRAWN: { label: '탈퇴', tone: 'fl-tone-danger' },
}

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
const LOG_ENTITY_OPTIONS = [
  { value: '', label: '모든 엔티티' },
  { value: 'TODO', label: '할일' },
  { value: 'CALENDAR_EVENT', label: '일정' },
  { value: 'NOTICE', label: '공지사항' },
  { value: 'NOTICE_COMMENT', label: '댓글' },
  { value: 'SCENARIO', label: '적재 시뮬레이션' },
  { value: 'OVERTIME_RECORD', label: '잔업/특근' },
  { value: 'USER', label: '사용자 계정' },
  { value: 'AUTH', label: '인증(로그인/비밀번호)' },
  { value: 'PROGRESS', label: '진행상황(이전 기능)' },
]

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
  const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'withdraw' | 'logs' | 'readLogs' | 'overtime'>('users')
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [withdrawUsers, setWithdrawUsers] = useState<any[]>([])
  const [overtimeRecords, setOvertimeRecords] = useState<OvertimeRecord[]>([])
  const [overtimeLoading, setOvertimeLoading] = useState(false)
  const [overtimeSummary, setOvertimeSummary] = useState<OvertimeSummary[]>([])
  const [overtimeFilters, setOvertimeFilters] = useState({ username: '', type: '', status: '' })
  const [overtimePagination, setOvertimePagination] = useState({ currentPage: 0, totalPages: 0, totalElements: 0, size: 20 })
  const [overtimeMonth, setOvertimeMonth] = useState<string>(() => new Date().toISOString().slice(0, 7))
  // 초기화 직후 한 번만 보여줄 임시 비밀번호. 화면을 닫으면 다시 볼 수 없다.
  const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(null)
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [overtimeDefaults, setOvertimeDefaults] = useState<OvertimeDefaults | null>(null)
  const [defaultsSaving, setDefaultsSaving] = useState(false)
  const [defaultsMsg, setDefaultsMsg] = useState('')
  // 엑셀 내보내기 기간. 급여 주기 설정으로 채워지지만 관리자가 자유롭게 고칠 수 있다.
  const [exportRange, setExportRange] = useState({ from: '', to: '' })
  const [overtimeExporting, setOvertimeExporting] = useState(false)
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
  const [readLogs, setReadLogs] = useState<AdminLog[]>([])
  const [readLogsLoading, setReadLogsLoading] = useState(false)
  const [readLogPagination, setReadLogPagination] = useState({
    currentPage: 0,
    totalPages: 0,
    totalElements: 0,
    size: 20
  })
  const [readLogFilters, setReadLogFilters] = useState({
    adminUsername: '',
    entityType: '',
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

  // 승인 대기 목록. 사용자 탭과 별도로 유지해 검색어에 영향을 받지 않게 한다.
  async function loadPendingUsers() {
    try {
      const list = await apiFetch('/api/admin/users?status=PENDING')
      setPendingUsers(list as any[])
    } catch (e: any) {
      setError(e.message || 'load failed')
    }
  }

  // 탈퇴 신청 목록. 가입 승인 대기와 같은 이유로 별도 관리한다.
  async function loadWithdrawUsers() {
    try {
      const list = await apiFetch('/api/admin/users?status=WITHDRAW_REQUESTED')
      setWithdrawUsers(list as any[])
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

  async function loadReadLogs(page: number = 0, customSize?: number) {
    try {
      setReadLogsLoading(true)
      const pageSize = customSize !== undefined ? customSize : readLogPagination.size
      const params = new URLSearchParams({
        page: page.toString(),
        size: pageSize.toString(),
        ...Object.fromEntries(
          Object.entries(readLogFilters).filter(([_, value]) => value && value.trim() !== '')
        )
      })
      const result = await apiFetch(`/api/admin/logs/read?${params}`)
      setReadLogs(result.content || [])
      setReadLogPagination({
        currentPage: result.number || 0,
        totalPages: result.totalPages || 0,
        totalElements: result.totalElements || 0,
        size: result.size || 20
      })
    } catch (e: any) {
      setError(e.message || '조회 로그 로드 실패')
    } finally {
      setReadLogsLoading(false)
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
      setExportRange(payrollCycle(d.payrollStartDay))
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
      // 주기가 바뀌면 내보내기 기간도 새 주기로 다시 맞춰준다.
      setExportRange(payrollCycle(saved.payrollStartDay))
      setDefaultsMsg('저장되었습니다.')
    } catch (e: any) {
      setError(e.message || '기본 근무시간 저장 실패')
    } finally {
      setDefaultsSaving(false)
    }
  }

  async function exportOvertimeExcel() {
    if (!exportRange.from || !exportRange.to) return
    setOvertimeExporting(true)
    try {
      const blob = await downloadOvertimeExcel(exportRange.from, exportRange.to)
      // 개발 환경은 교차 출처라 서버가 준 Content-Disposition을 읽을 수 없어 파일명을 여기서 만든다.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `잔업특근_${exportRange.from}_${exportRange.to}.xlsx`
      link.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      setError(e.message || '엑셀 다운로드 실패')
    } finally {
      setOvertimeExporting(false)
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

  // 대기 건수는 탭 배지에 항상 떠 있어야 하므로 진입 시 함께 읽는다
  useEffect(() => {
    loadUsers('')
    loadPendingUsers()
    loadWithdrawUsers()
  }, [])

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPendingUsers()
    }
    if (activeTab === 'withdraw') {
      loadWithdrawUsers()
    }
    if (activeTab === 'logs') {
      loadLogs(0) // 탭 변경 시 첫 페이지로 이동
      loadLogStats()
    }
    if (activeTab === 'readLogs') {
      loadReadLogs(0)
      loadLogStats()
    }
    if (activeTab === 'overtime') {
      loadOvertimeRecords(0)
      loadOvertimeSummary()
      loadOvertimeDefaults()
    } else {
      // 탭을 떠나면 모달도 닫는다. 남겨두면 다시 들어올 때 폼이 열린 채로 뜬다.
      setBulkOpen(false)
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs(0) // 필터 변경 시 첫 페이지로 이동
    }
  }, [logFilters])

  useEffect(() => {
    if (activeTab === 'readLogs') {
      loadReadLogs(0) // 필터 변경 시 첫 페이지로 이동
    }
  }, [readLogFilters])

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

  // 승인·거절은 두 목록의 상태를 동시에 바꾸므로 양쪽을 다시 읽는다
  async function decideUser(id: number, decision: 'approve' | 'reject') {
    try {
      await apiFetch(`/api/admin/users/${id}/${decision}`, { method: 'POST' })
      await Promise.all([loadPendingUsers(), loadUsers()])
    } catch (e: any) { setError(e.message) }
  }

  // 탈퇴 확정은 되돌릴 수 없으므로 항상 사유를 묻고 한 번 더 확인한다
  async function withdrawUser(u: any) {
    const reason = window.prompt(
      `${u.username}${u.displayName ? ` (${u.displayName})` : ''} 계정을 탈퇴 처리합니다.\n` +
        '이메일·표시 이름이 삭제되고 다시 로그인할 수 없게 됩니다. 잔업·특근 기록은 보존됩니다.\n\n' +
        '처리 사유를 입력하세요.',
      u.withdrawReason || '',
    )
    if (reason === null) return
    try {
      await apiFetch(`/api/admin/users/${u.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      await Promise.all([loadUsers(), loadWithdrawUsers()])
    } catch (e: any) { setError(e.message) }
  }

  async function rejectWithdraw(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/withdraw/reject`, { method: 'POST' })
      await Promise.all([loadUsers(), loadWithdrawUsers()])
    } catch (e: any) { setError(e.message) }
  }

  /**
   * 비밀번호 초기화.
   *
   * 자가 재설정을 없앤 자리를 대신한다. 서버가 만든 임시 비밀번호를 응답으로 한 번
   * 받아 관리자가 본인에게 직접 전달하는 방식이라, 받은 값을 놓치면 다시 초기화해야 한다.
   */
  async function resetPassword(u: any) {
    const label = `${u.username}${u.displayName ? ` (${u.displayName})` : ''}`
    if (!window.confirm(
      `${label} 계정의 비밀번호를 초기화합니다.\n\n` +
        '임시 비밀번호가 발급되고 이 계정의 기존 로그인은 모두 해제됩니다.\n' +
        '임시 비밀번호는 지금 한 번만 표시됩니다.',
    )) return
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' })
      setTempPassword({ username: res.username, password: res.temporaryPassword })
    } catch (e: any) { setError(e.message) }
  }

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
            className={`fl-seg-btn${activeTab === 'pending' ? ' is-active' : ''}${pendingUsers.length > 0 ? ' fl-tone-warn' : ''}`}
            onClick={() => setActiveTab('pending')}
          >
            가입 승인{pendingUsers.length > 0 ? ` (${pendingUsers.length})` : ''}
          </button>
          <button
            className={`fl-seg-btn${activeTab === 'withdraw' ? ' is-active' : ''}${withdrawUsers.length > 0 ? ' fl-tone-warn' : ''}`}
            onClick={() => setActiveTab('withdraw')}
          >
            탈퇴 신청{withdrawUsers.length > 0 ? ` (${withdrawUsers.length})` : ''}
          </button>
          <button
            className={`fl-seg-btn${activeTab === 'logs' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            변경 이력
          </button>
          <button
            className={`fl-seg-btn${activeTab === 'readLogs' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('readLogs')}
          >
            조회 이력
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
              <div style={{ textAlign: 'right' }}>관리</div>
            </div>

            {users.length === 0 ? (
              <div className="fl-empty">사용자가 없습니다.</div>
            ) : (
              users.map((u: any) => {
                const roles: string[] = u.roles || []
                const isAdmin = roles.includes('ADMIN')
                const isSuperAdmin = roles.includes('SUPER_ADMIN')
                const isWithdrawn = u.status === 'WITHDRAWN'
                const statusBadge = USER_STATUS_BADGE[u.status as string]
                // 본인 계정을 잠그면 관리자 자신이 락아웃된다(서버에서도 막지만 버튼부터 감춘다)
                const canWithdraw =
                  !isSuperAdmin && u.status !== 'WITHDRAWN' && u.username !== getMe()

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
                      {statusBadge && (
                        <span
                          className={`fl-badge ${statusBadge.tone}`}
                          style={{ marginLeft: 6 }}
                        >
                          {statusBadge.label}
                        </span>
                      )}
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

                    <span className="fl-cell-actions ad-user-actions">
                      {/*
                        역할은 상태를 겸해 보여 주므로 글자로 남긴다.
                        탈퇴 계정에는 아예 띄우지 않는다 — 탈퇴 처리가 역할을 USER로
                        되돌려 놓았는데 여기서 다시 ADMIN을 줄 수 있으면 죽은 계정에
                        권한이 되살아난다.
                      */}
                      {isWithdrawn ? (
                        // 역할 칸에 이미 "탈퇴" 배지가 있으므로 여기서는 비워 둔다
                        <span className="ad-row-none" aria-label="처리할 동작 없음">—</span>
                      ) : isSuperAdmin ? (
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

                      {/*
                        가끔 쓰는 두 동작은 아이콘으로 접는다. 글자 버튼 세 개는
                        칸을 넘겨 줄바꿈되면서 행 높이가 제각각이 됐다.
                        둘 다 누르면 확인 창이 먼저 뜬다.
                      */}
                      <span className="ad-row-tools">
                        {!isWithdrawn && (
                          <button
                            className="fl-btn-icon ad-row-action"
                            onClick={() => resetPassword(u)}
                            title="비밀번호 초기화"
                            aria-label={`${u.username} 비밀번호 초기화`}
                          >
                            <KeyIcon />
                          </button>
                        )}
                        {canWithdraw && (
                          <button
                            className="fl-btn-icon ad-row-action is-danger"
                            onClick={() => withdrawUser(u)}
                            title="탈퇴 처리"
                            aria-label={`${u.username} 탈퇴 처리`}
                          >
                            <UserMinusIcon />
                          </button>
                        )}
                      </span>
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {activeTab === 'pending' && (
        <section className="fl-card">
          <div className="fl-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="fl-card-title">가입 승인 대기</span>
              <span className="fl-card-count">총 {pendingUsers.length}명</span>
            </div>
            <button className="fl-btn" onClick={() => loadPendingUsers()}>
              새로고침
            </button>
          </div>

          <div className="fl-card-body fl-flush">
            <div className="fl-th ad-user-head ad-pending-head">
              <div>ID</div>
              <div>사용자</div>
              <div>역할</div>
              <div>이름/닉네임</div>
              <div style={{ textAlign: 'right' }}>승인</div>
            </div>

            {pendingUsers.length === 0 ? (
              <div className="fl-empty">승인을 기다리는 신청이 없습니다.</div>
            ) : (
              pendingUsers.map((u: any) => (
                <div key={u.id} className="fl-tr ad-user-row ad-pending-row">
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
                  </span>

                  <span className="ad-user-roles">
                    <span className="ad-label">역할</span>
                    {(u.roles || []).join(', ')}
                  </span>

                  <span>
                    <span className="ad-label">이름/닉네임</span>
                    {u.displayName || '-'}
                  </span>

                  <span className="fl-cell-actions">
                    <button
                      className="fl-btn fl-btn-sm fl-btn-primary"
                      onClick={() => decideUser(u.id, 'approve')}
                    >
                      승인
                    </button>
                    <button
                      className="fl-btn fl-btn-sm"
                      onClick={() => decideUser(u.id, 'reject')}
                    >
                      거절
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'withdraw' && (
        <section className="fl-card">
          <div className="fl-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="fl-card-title">탈퇴 신청</span>
              <span className="fl-card-count">총 {withdrawUsers.length}명</span>
            </div>
            <button className="fl-btn" onClick={() => loadWithdrawUsers()}>
              새로고침
            </button>
          </div>

          <div className="fl-card-body fl-flush">
            <p className="ad-withdraw-guide">
              탈퇴를 확정하면 이메일·표시 이름이 삭제되고 해당 계정으로 다시 로그인할 수 없습니다.
              아이디는 재사용할 수 없으며, 제출된 잔업·특근 기록은 그대로 보존됩니다.
            </p>

            <div className="fl-th ad-user-head ad-withdraw-head">
              <div>ID</div>
              <div>사용자</div>
              <div>신청 일시</div>
              <div>사유</div>
              <div style={{ textAlign: 'right' }}>처리</div>
            </div>

            {withdrawUsers.length === 0 ? (
              <div className="fl-empty">처리를 기다리는 탈퇴 신청이 없습니다.</div>
            ) : (
              withdrawUsers.map((u: any) => (
                <div key={u.id} className="fl-tr ad-user-row ad-withdraw-row">
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

                  <span>
                    <span className="ad-label">신청 일시</span>
                    {u.withdrawRequestedAt
                      ? new Date(u.withdrawRequestedAt).toLocaleString('ko-KR')
                      : '-'}
                  </span>

                  <span className="ad-withdraw-reason">
                    <span className="ad-label">사유</span>
                    {u.withdrawReason || '-'}
                  </span>

                  <span className="fl-cell-actions">
                    <button
                      className="fl-btn fl-btn-sm fl-btn-danger"
                      onClick={() => withdrawUser(u)}
                    >
                      탈퇴 확정
                    </button>
                    <button
                      className="fl-btn fl-btn-sm"
                      onClick={() => rejectWithdraw(u.id)}
                    >
                      반려
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {activeTab === 'logs' && (
        <>
          {logStats && (
            <div className="fl-stat-grid ad-stat-grid">
              <div className="fl-stat">
                <div className="fl-stat-label">총 변경 로그 수</div>
                <div className="fl-stat-value">
                  <span className="fl-stat-num">{logStats.totalLogs}</span>
                  <span className="fl-stat-unit">건</span>
                </div>
              </div>
              <div className="fl-stat">
                <div className="fl-stat-label">오늘 변경 로그 수</div>
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
                <span className="fl-card-title">변경 이력</span>
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
                  {LOG_ENTITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <select
                  className="fl-input"
                  value={logFilters.action}
                  onChange={(e) => setLogFilters((prev) => ({ ...prev, action: e.target.value }))}
                  aria-label="작업 필터"
                >
                  <option value="">모든 작업</option>
                  <option value="CREATE">생성</option>
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

              <LogRows logs={logs} loading={logsLoading} />
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

      {activeTab === 'readLogs' && (
        <>
          {logStats && (
            <div className="fl-stat-grid ad-stat-grid">
              <div className="fl-stat">
                <div className="fl-stat-label">총 조회 로그 수</div>
                <div className="fl-stat-value">
                  <span className="fl-stat-num">{logStats.totalReadLogs}</span>
                  <span className="fl-stat-unit">건</span>
                </div>
              </div>
              <div className="fl-stat">
                <div className="fl-stat-label">오늘 조회 로그 수</div>
                <div className="fl-stat-value">
                  <span className="fl-stat-num">{logStats.todayReadLogs}</span>
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
                <span className="fl-card-title">조회 이력</span>
                <span className="fl-card-count">총 {readLogPagination.totalElements}건</span>
                <span className="ad-log-note">90일 후 자동 삭제</span>
              </div>
              <div className="ad-filters">
                <input
                  className="fl-input"
                  placeholder="관리자명"
                  value={readLogFilters.adminUsername}
                  onChange={(e) => setReadLogFilters((prev) => ({ ...prev, adminUsername: e.target.value }))}
                  style={{ width: 130 }}
                />
                <select
                  className="fl-input"
                  value={readLogFilters.entityType}
                  onChange={(e) => setReadLogFilters((prev) => ({ ...prev, entityType: e.target.value }))}
                  aria-label="엔티티 필터"
                >
                  {LOG_ENTITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="fl-input"
                  value={readLogFilters.startDate}
                  onChange={(e) => setReadLogFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                  aria-label="시작일"
                />
                <input
                  type="date"
                  className="fl-input"
                  value={readLogFilters.endDate}
                  onChange={(e) => setReadLogFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                  aria-label="종료일"
                />
                <select
                  className="fl-input"
                  value={readLogPagination.size}
                  onChange={(e) => {
                    const newSize = parseInt(e.target.value)
                    setReadLogPagination((prev) => ({ ...prev, size: newSize, currentPage: 0 }))
                    loadReadLogs(0, newSize)
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
                    setReadLogFilters({ adminUsername: '', entityType: '', startDate: '', endDate: '' })
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

              <LogRows logs={readLogs} loading={readLogsLoading} />
            </div>

            <Pager
              page={readLogPagination.currentPage}
              totalPages={readLogPagination.totalPages}
              onChange={loadReadLogs}
              disabled={readLogsLoading}
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
                <button className="fl-btn fl-btn-primary" onClick={() => setBulkOpen(true)}>
                  일괄 등록
                </button>
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

                    <div className="fl-field">
                      <span className="ot-defaults-label">급여 주기 시작일</span>
                      <div className="ot-payroll-day">
                        <input
                          type="number"
                          className="fl-input"
                          min={1}
                          max={28}
                          value={overtimeDefaults.payrollStartDay ?? 1}
                          onChange={(e) =>
                            setOvertimeDefaults({
                              ...overtimeDefaults,
                              payrollStartDay: Number(e.target.value),
                            })
                          }
                          aria-label="급여 주기 시작일"
                        />
                        <span className="ot-payroll-day-unit">일</span>
                      </div>
                    </div>

                    <div className="fl-hint">
                      저녁 휴게시간 17:00~17:30에 걸친 시간은 구분과 무관하게 총 근무시간에서 자동 차감됩니다.
                      특근은 6시간 이상 근무 시 점심 휴게시간 1시간도 함께 차감됩니다.
                      <br />
                      급여 주기 시작일을 15로 두면 정산 기간이 &lsquo;전달 15일 ~ 이번달 14일&rsquo;이 됩니다.
                      1이면 달력 월과 같습니다. (29~31일은 없는 달이 있어 지정할 수 없습니다)
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

              {/* 엑셀 내보내기 — 급여 주기가 달력 월과 어긋날 수 있어 위 월 선택기와 별개로 기간을 받는다 */}
              <div className="ot-export">
                <span className="ot-export-title">엑셀 다운로드</span>
                <div className="fl-range">
                  <input
                    type="date"
                    className="fl-input"
                    value={exportRange.from}
                    onChange={(e) => setExportRange((prev) => ({ ...prev, from: e.target.value }))}
                    aria-label="내보낼 기간 시작일"
                  />
                  <span className="fl-range-sep">–</span>
                  <input
                    type="date"
                    className="fl-input"
                    value={exportRange.to}
                    onChange={(e) => setExportRange((prev) => ({ ...prev, to: e.target.value }))}
                    aria-label="내보낼 기간 종료일"
                  />
                </div>
                <button
                  className="fl-btn fl-btn-primary"
                  onClick={exportOvertimeExcel}
                  disabled={overtimeExporting || !exportRange.from || !exportRange.to}
                >
                  {overtimeExporting ? '생성 중...' : '엑셀 다운로드'}
                </button>
                <div className="fl-hint">
                  {overtimeDefaults
                    ? `급여 주기 시작일 ${overtimeDefaults.payrollStartDay ?? 1}일 기준으로 채워졌습니다. `
                    : ''}
                  상세 내역(대기·반려 포함)과 기간 집계(승인 건만) 두 시트로 받습니다.
                </div>
              </div>
            </section>
          </div>

          {bulkOpen && (
            <OvertimeBulkModal
              defaults={overtimeDefaults}
              onClose={() => setBulkOpen(false)}
              onCreated={() => {
                loadOvertimeRecords(0)
                loadOvertimeSummary()
              }}
            />
          )}
        </div>
      )}
      {tempPassword && (
        <TempPasswordModal
          username={tempPassword.username}
          password={tempPassword.password}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  )
}

/**
 * 초기화로 발급된 임시 비밀번호를 보여준다.
 *
 * 서버는 이 값을 저장하지 않고 해시만 남기므로, 이 화면을 닫으면 다시 볼 방법이
 * 없다. 관리자가 옮겨 적을 시간을 주는 것이 이 모달의 유일한 역할이라
 * 바깥을 눌러서는 닫히지 않게 한다.
 */
function TempPasswordModal({
  username,
  password,
  onClose,
}: {
  username: string
  password: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // 클립보드 권한이 없으면(비 HTTPS 등) 화면의 값을 직접 옮겨 적으면 된다
      setCopied(false)
    }
  }

  return (
    <div className="fl-modal-overlay">
      <div className="fl-modal ad-temp-modal" role="dialog" aria-modal="true">
        <div className="fl-modal-head">
          <div className="fl-modal-heading">
            <span className="fl-modal-title">임시 비밀번호 발급</span>
            <span className="fl-modal-sub">{username} 계정의 비밀번호가 초기화되었습니다.</span>
          </div>
        </div>

        <div className="fl-modal-body">
          <div className="ad-temp-value">
            <code>{password}</code>
            <button type="button" className="fl-btn fl-btn-sm" onClick={copy}>
              {copied ? '복사됨' : '복사'}
            </button>
          </div>

          <div className="fl-hint ad-temp-warn">
            이 값은 지금만 볼 수 있습니다. 창을 닫으면 다시 확인할 수 없고, 필요하면 다시
            초기화해야 합니다. 본인에게 전달한 뒤 로그인해서 새 비밀번호로 바꾸도록 안내하세요.
          </div>
        </div>

        <div className="fl-modal-foot">
          <span className="fl-modal-foot-note">이 계정의 기존 로그인은 모두 해제되었습니다.</span>
          <div className="fl-modal-foot-actions">
            <button type="button" className="fl-btn fl-btn-primary" onClick={onClose}>
              옮겨 적었습니다
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

interface BulkPerson {
  id: number
  username: string
  displayName?: string
  status?: string
}

/**
 * 관리자가 여러 직원의 잔업/특근을 한 번에 등록하는 모달.
 *
 * 한 번에 등록되는 건 모두 같은 근무일·구분·시간이다. 직원마다 시간이 다르면
 * 나눠서 등록하거나 등록 후 개별 수정한다.
 */
function OvertimeBulkModal({
  defaults,
  onClose,
  onCreated,
}: {
  defaults: OvertimeDefaults | null
  onClose: () => void
  onCreated: () => void
}) {
  const [people, setPeople] = useState<BulkPerson[]>([])
  const [peopleLoading, setPeopleLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<number[]>([])

  const [type, setType] = useState<OvertimeType>('OVERTIME')
  const [workDate, setWorkDate] = useState(() => toYmd(new Date()))
  const [startTime, setStartTime] = useState(() => defaultTimesFor('OVERTIME', defaults)[0])
  const [endTime, setEndTime] = useState(() => defaultTimesFor('OVERTIME', defaults)[1])
  const [reason, setReason] = useState('')
  const [approveNow, setApproveNow] = useState(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<OvertimeBulkResult | null>(null)

  // 탈퇴·거절·가입대기 계정은 근무 기록을 남길 대상이 아니다.
  useEffect(() => {
    apiFetch('/api/admin/users')
      .then((list: BulkPerson[]) =>
        setPeople(list.filter((u) => u.status === 'APPROVED' || u.status === 'WITHDRAW_REQUESTED')),
      )
      .catch((e: any) => setError(e.message || '직원 목록을 불러오지 못했습니다'))
      .finally(() => setPeopleLoading(false))
  }, [])

  // 설정을 늦게 받았고 아직 시간을 건드리지 않았으면 그때 기본값을 채운다.
  useEffect(() => {
    if (!defaults || startTime || endTime) return
    const [s, e] = defaultTimesFor(type, defaults)
    setStartTime(s)
    setEndTime(e)
  }, [defaults])

  function close() {
    // 결과 화면까지 왔다면 이미 등록된 건이 있으므로 목록을 다시 읽게 한다.
    if (result) onCreated()
    onClose()
  }

  // 모달이 열려 있는 동안 뒤 배경이 스크롤되지 않게 한다
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // close가 result 상태에 따라 달라지므로 매 렌더 다시 건다
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function onTypeChange(next: OvertimeType) {
    setType(next)
    const [s, e] = defaultTimesFor(next, defaults)
    setStartTime(s)
    setEndTime(e)
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return people
    return people.filter(
      (p) =>
        p.username.toLowerCase().includes(q) || (p.displayName || '').toLowerCase().includes(q),
    )
  }, [people, search])

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.includes(p.id))

  function toggleAllVisible() {
    // 검색 중이면 보이는 사람만 대상으로 한다. 필터 밖의 선택은 유지된다.
    const visibleIds = visible.map((p) => p.id)
    setSelected((prev) =>
      allVisibleSelected
        ? prev.filter((id) => !visibleIds.includes(id))
        : [...new Set([...prev, ...visibleIds])],
    )
  }

  function togglePerson(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (selected.length === 0) {
      setError('직원을 한 명 이상 선택해주세요')
      return
    }
    if (!workDate) {
      setError('근무일을 입력해주세요')
      return
    }
    if (!startTime || !endTime) {
      setError('시작–종료 시간을 입력해주세요')
      return
    }

    setSubmitting(true)
    try {
      const res = await createOvertimeRecordsBulk({
        userIds: selected,
        workDate,
        type,
        startTime,
        endTime,
        totalMinutes: null,
        reason,
        approveNow,
      })
      // 전원 등록됐으면 더 볼 게 없으니 바로 닫는다. 빠진 사람이 있으면 이유를 보여준다.
      if (res.skipped.length === 0) {
        onCreated()
        onClose()
        return
      }
      setResult(res)
    } catch (e: any) {
      setError(e.message || '일괄 등록에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  const duration = durationOf(type, startTime, endTime)

  return (
    <div
      className="fl-modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <form className="fl-modal ot-bulk-modal" onSubmit={submit} role="dialog" aria-modal="true">
        <div className="fl-modal-head">
          <div className="fl-modal-heading">
            <span className="fl-modal-title">{result ? '일괄 등록 결과' : '잔업/특근 일괄 등록'}</span>
            <span className="fl-modal-sub">
              {result
                ? '아래 직원은 등록되지 않았습니다.'
                : '선택한 직원 전원에게 같은 근무일·구분·시간으로 한 건씩 등록됩니다.'}
            </span>
          </div>
          <button type="button" className="fl-modal-close" onClick={close} aria-label="닫기">
            ✕
          </button>
        </div>

        {result ? (
          <>
            <div className="fl-modal-body">
              <div className="ot-bulk-result">
                <span className="ot-bulk-result-num">{result.created}</span>
                <span className="ot-bulk-result-text">
                  명 등록됨
                  {result.records.length > 0 &&
                    ` · 1인당 ${formatMinutes(result.records[0].totalMinutes)}`}
                </span>
              </div>

              <div className="fl-field">
                <span className="fl-field-label">
                  제외된 직원 <span className="fl-optional">{result.skipped.length}명</span>
                </span>
                <ul className="ot-bulk-skip">
                  {result.skipped.map((s) => (
                    <li key={s.name}>
                      <span className="ot-bulk-skip-name">{s.name}</span>
                      <span className="ot-bulk-skip-reason">{s.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="fl-modal-foot">
              <span className="fl-modal-foot-note">
                이미 등록된 건은 목록에서 개별 수정할 수 있습니다.
              </span>
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn fl-btn-primary" onClick={close}>
                  확인
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="fl-modal-body">
              <div className="fl-field">
                <span className="fl-field-label">구분</span>
                <div className="ot-choice-grid">
                  <button
                    type="button"
                    className={`ot-choice${type === 'OVERTIME' ? ' is-active' : ''}`}
                    onClick={() => onTypeChange('OVERTIME')}
                  >
                    <span className="ot-choice-name">잔업</span>
                    <span className="ot-choice-sub">
                      평일 연장근무
                      {defaults &&
                        ` · 기본 ${formatTime(defaults.overtimeStart)}–${formatTime(defaults.overtimeEnd)}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`ot-choice ot-choice-special${type === 'SPECIAL' ? ' is-active' : ''}`}
                    onClick={() => onTypeChange('SPECIAL')}
                  >
                    <span className="ot-choice-name">특근</span>
                    <span className="ot-choice-sub">
                      휴일·주말 근무
                      {defaults &&
                        ` · 기본 ${formatTime(defaults.specialStart)}–${formatTime(defaults.specialEnd)}`}
                    </span>
                  </button>
                </div>
              </div>

              <div className="ot-modal-pair">
                <label className="fl-field">
                  <span className="fl-field-label">근무일</span>
                  <input
                    type="date"
                    className="fl-input"
                    value={workDate}
                    onChange={(e) => setWorkDate(e.target.value)}
                    required
                  />
                </label>
                <div className="fl-field">
                  <span className="fl-field-label">
                    근무 시간
                    {duration !== null && <span className="ot-duration">{formatMinutes(duration)}</span>}
                  </span>
                  <div className="fl-range">
                    <input
                      type="time"
                      className="fl-input"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      aria-label="시작 시간"
                    />
                    <span className="fl-range-sep">–</span>
                    <input
                      type="time"
                      className="fl-input"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      aria-label="종료 시간"
                    />
                  </div>
                </div>
              </div>

              <div className="fl-field">
                <span className="fl-field-label">
                  직원 <span className="fl-optional">{selected.length}명 선택됨</span>
                </span>
                <div className="ot-bulk-picker">
                  <div className="ot-bulk-picker-head">
                    <input
                      className="fl-input"
                      placeholder="이름 · 사번 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    <button
                      type="button"
                      className="fl-btn fl-btn-sm"
                      onClick={toggleAllVisible}
                      disabled={visible.length === 0}
                    >
                      {allVisibleSelected ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  <div className="ot-bulk-list">
                    {peopleLoading ? (
                      <div className="fl-empty">불러오는 중...</div>
                    ) : visible.length === 0 ? (
                      <div className="fl-empty">조건에 맞는 직원이 없습니다.</div>
                    ) : (
                      visible.map((p) => (
                        <label
                          key={p.id}
                          className={`ot-bulk-person${selected.includes(p.id) ? ' is-on' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected.includes(p.id)}
                            onChange={() => togglePerson(p.id)}
                          />
                          <span className="fl-avatar fl-avatar-sm">
                            {(p.displayName || p.username || '?').charAt(0)}
                          </span>
                          <span className="ot-bulk-person-name">{p.displayName || p.username}</span>
                          <span className="ot-bulk-person-id">{p.username}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <label className="fl-field">
                <span className="fl-field-label">
                  사유 <span className="fl-optional">(선택 · 전원 동일하게 기록됩니다)</span>
                </span>
                <textarea
                  className="fl-input fl-textarea"
                  placeholder="예: 8월 물량 대응 특근"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>

              <label className="ot-bulk-approve">
                <input
                  type="checkbox"
                  checked={approveNow}
                  onChange={(e) => setApproveNow(e.target.checked)}
                />
                <span>
                  등록과 동시에 승인 처리
                  <span className="fl-hint">
                    끄면 직원 본인 신청과 같은 &lsquo;승인 대기&rsquo; 상태로 들어갑니다.
                  </span>
                </span>
              </label>

              <div className="fl-hint">
                저녁 휴게시간 17:00~17:30에 걸친 시간은 총 근무시간에서 자동 차감됩니다.
                {type === 'SPECIAL' && ' 특근은 6시간 이상 근무 시 점심 휴게시간 1시간도 함께 차감됩니다.'}
                <br />
                같은 날 같은 구분으로 이미 기록이 있는 직원은 중복되지 않도록 자동으로 제외됩니다.
              </div>

              {error && <div className="fl-error">{error}</div>}
            </div>

            <div className="fl-modal-foot">
              <span className="fl-modal-foot-note">
                {selected.length > 0
                  ? `${selected.length}명 · ${duration !== null ? formatMinutes(duration) : '시간 미입력'}`
                  : '직원을 선택해주세요'}
              </span>
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn" onClick={close}>
                  취소
                </button>
                <button
                  type="submit"
                  className="fl-btn fl-btn-primary"
                  disabled={submitting || selected.length === 0}
                >
                  {submitting ? '등록 중...' : `${selected.length || ''}명 등록`}
                </button>
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

/** 변경 이력·조회 이력 탭이 공유하는 로그 행 목록 */
function LogRows({ logs, loading }: { logs: AdminLog[]; loading: boolean }) {
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
      ))}
    </>
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
