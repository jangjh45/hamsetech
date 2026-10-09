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
  downloadOvertimeExcel,
  type OvertimeRecord,
  type OvertimeSummary,
  type OvertimeDefaults,
} from '../api/overtimeRecords'
import { formatTime, payrollCycle } from '../utils/formatDate'

import Pager from '../components/Pager'
import { KeyIcon, UserMinusIcon } from '../components/AdminIcons'
import DisplayNameEditor from '../components/admin/DisplayNameEditor'
import LogRows from '../components/admin/LogRows'
import OvertimeBulkModal from '../components/admin/OvertimeBulkModal'
import TempPasswordModal from '../components/admin/TempPasswordModal'
import {
  LOG_ENTITY_OPTIONS,
  OVERTIME_STATUS_LABEL,
  OVERTIME_STATUS_TONE,
  OVERTIME_TYPE_LABEL,
  USER_STATUS_BADGE,
  formatWorkDate,
  type AdminLog,
} from '../components/admin/adminShared'
import '../styles/admin.css'
import '../styles/overtime.css'

/** 목록 표의 근무시간 한 줄 */
function workTimeText(r: OvertimeRecord): string {
  if (r.startTime && r.endTime) {
    const h = Math.floor(r.totalMinutes / 60)
    const m = r.totalMinutes % 60
    return `${formatTime(r.startTime)}–${formatTime(r.endTime)} · ${h}h${m > 0 ? `${m}m` : ''}`
  }
  return `총 ${r.totalMinutes}분`
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
        <div className="fl-seg ad-tabs" role="tablist" aria-label="관리자 메뉴">
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

