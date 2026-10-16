import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  createOvertimeRecord,
  deleteOvertimeRecord,
  getOvertimeDefaults,
  listMyOvertimeRecords,
  updateOvertimeRecord,
  type OvertimeDefaults,
  type OvertimeRecord,
  type OvertimeStatus,
  type OvertimeType,
} from '../api/overtimeRecords'
import { formatMinutes, formatTime, toYmd } from '../utils/formatDate'
import { defaultTimesFor, durationOf } from '../utils/overtime'
import Pager from '../components/Pager'
import { useConfirm } from '../components/ConfirmDialog'
import '../styles/overtime.css'

const PAGE_SIZE = 10
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const TYPE_LABEL: Record<OvertimeType, string> = { OVERTIME: '잔업', SPECIAL: '특근' }
const STATUS_LABEL: Record<OvertimeStatus, string> = { PENDING: '대기', APPROVED: '승인', REJECTED: '반려' }
const STATUS_TONE: Record<OvertimeStatus, string> = {
  PENDING: 'fl-tone-warn',
  APPROVED: 'fl-tone-success',
  REJECTED: 'fl-tone-danger',
}

type StatusFilter = 'ALL' | OvertimeStatus
type TypeFilter = 'ALL' | OvertimeType

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** 'YYYY-MM' → 그 달 1일의 Date */
function monthStart(month: string): Date {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, (m || 1) - 1, 1)
}

function shiftMonth(month: string, delta: number): string {
  const d = monthStart(month)
  d.setMonth(d.getMonth() + delta)
  return monthKey(d)
}

/** 'YYYY-MM' → '2026년 8월' (앞자리 0 없이) */
function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}

interface CalCell {
  date: string
  day: number
  inMonth: boolean
  dow: number
}

function monthMatrix(first: Date): CalCell[] {
  const year = first.getFullYear()
  const month = first.getMonth()
  const startDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const cells: CalCell[] = []
  for (let i = startDay - 1; i >= 0; i--) {
    const dt = new Date(year, month - 1, prevMonthDays - i)
    cells.push({ date: toYmd(dt), day: dt.getDate(), inMonth: false, dow: dt.getDay() })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d)
    cells.push({ date: toYmd(dt), day: d, inMonth: true, dow: dt.getDay() })
  }
  for (let i = 1; cells.length < 42; i++) {
    const dt = new Date(year, month + 1, i)
    cells.push({ date: toYmd(dt), day: dt.getDate(), inMonth: false, dow: dt.getDay() })
  }
  return cells
}

/** '2026-08-14' → '08.14 (금)' */
function formatWorkDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')} (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

/** '2026-08-14' → '2026년 8월 14일 (금)' */
function formatLongDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return `${y}년 ${m}월 ${d}일 (${WEEKDAYS[new Date(y, m - 1, d).getDay()]})`
}

/** 목록·달력에 공통으로 쓰는 근무시간 표기 */
function workTimeText(r: OvertimeRecord): string {
  if (r.startTime && r.endTime) {
    return `${formatTime(r.startTime)} – ${formatTime(r.endTime)} · ${formatMinutes(r.totalMinutes)}`
  }
  return `총 ${r.totalMinutes}분`
}

interface FormState {
  workDate: string
  type: OvertimeType
  startTime: string
  endTime: string
  totalMinutes: string
  reason: string
}

export default function OvertimeRecordsPage() {
  const { confirm } = useConfirm()
  const [records, setRecords] = useState<OvertimeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [error, setError] = useState('')
  const [defaults, setDefaults] = useState<OvertimeDefaults | null>(null)

  const [month, setMonth] = useState<string>(() => monthKey(new Date()))
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [page, setPage] = useState(0)
  const [selectedDate, setSelectedDate] = useState<string>(() => toYmd(new Date()))

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<OvertimeRecord | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const loadRequestId = useRef(0)

  const calendarCells = useMemo(() => monthMatrix(monthStart(month)), [month])
  const recordRange = {
    from: calendarCells[0].date,
    to: calendarCells[calendarCells.length - 1].date,
  }

  const load = useCallback(async (from: string, to: string) => {
    const requestId = ++loadRequestId.current
    setLoading(true)
    setLoadError('')
    try {
      const result = await listMyOvertimeRecords(from, to)
      if (requestId === loadRequestId.current) setRecords(result)
    } catch (e: unknown) {
      if (requestId === loadRequestId.current) {
        setLoadError(e instanceof Error ? e.message : '목록을 불러오지 못했습니다')
      }
    } finally {
      if (requestId === loadRequestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(recordRange.from, recordRange.to)
    return () => { loadRequestId.current += 1 }
  }, [load, recordRange.from, recordRange.to, reloadKey])

  // 기본 근무시간은 등록 폼의 편의 기능이라 실패해도 화면은 정상 동작한다.
  useEffect(() => {
    getOvertimeDefaults().then(setDefaults).catch(() => {})
  }, [])

  // 현재 달력의 42칸 범위만 불러와 날짜별로 묶는다 (앞뒤 달의 날짜 칸 포함).
  const calendarRecords = useMemo(
    () => records.filter((r) =>
      (statusFilter === 'ALL' || r.status === statusFilter) &&
      (typeFilter === 'ALL' || r.type === typeFilter),
    ),
    [records, statusFilter, typeFilter],
  )

  const recordsByDate = useMemo(() => {
    const map: Record<string, OvertimeRecord[]> = {}
    for (const r of calendarRecords) (map[r.workDate] ||= []).push(r)
    return map
  }, [calendarRecords])

  const monthRecords = useMemo(
    () => records.filter((r) => r.workDate.startsWith(month)),
    [records, month],
  )

  const filtered = useMemo(
    () =>
      monthRecords.filter(
        (r) =>
          (statusFilter === 'ALL' || r.status === statusFilter) &&
          (typeFilter === 'ALL' || r.type === typeFilter),
      ),
    [monthRecords, statusFilter, typeFilter],
  )

  const stats = useMemo(() => {
    const sumBy = (rs: OvertimeRecord[]) => rs.reduce((sum, r) => sum + r.totalMinutes, 0)
    const daysOf = (rs: OvertimeRecord[]) => new Set(rs.map((r) => r.workDate)).size
    const overtime = monthRecords.filter((r) => r.type === 'OVERTIME')
    const special = monthRecords.filter((r) => r.type === 'SPECIAL')
    const pending = monthRecords.filter((r) => r.status === 'PENDING')
    const approved = monthRecords.filter((r) => r.status === 'APPROVED')
    return {
      overtimeMinutes: sumBy(overtime),
      overtimeDays: daysOf(overtime),
      specialMinutes: sumBy(special),
      specialDays: daysOf(special),
      pendingCount: pending.length,
      // 가장 오래된 대기 건이 언제 것인지가 "언제쯤 처리되나"의 실마리가 된다
      oldestPending: pending.reduce<string | null>(
        (oldest, r) => (oldest === null || r.workDate < oldest ? r.workDate : oldest),
        null,
      ),
      approvedMinutes: sumBy(approved),
    }
  }, [monthRecords])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages - 1)
  const pageRecords = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  // 필터가 바뀌면 항상 첫 페이지부터 본다
  useEffect(() => {
    setPage(0)
  }, [month, statusFilter, typeFilter])

  const todayYmd = toYmd(new Date())
  const selectedRecords = recordsByDate[selectedDate] || []
  const selectedMinutes = selectedRecords.reduce((sum, r) => sum + r.totalMinutes, 0)

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth)
    if (!selectedDate.startsWith(nextMonth)) {
      const today = toYmd(new Date())
      setSelectedDate(today.startsWith(nextMonth) ? today : `${nextMonth}-01`)
    }
  }

  // ── 모달 ───────────────────────────────────────────────────

  function openCreate() {
    const [startTime, endTime] = defaultTimesFor('OVERTIME', defaults)
    // 보고 있는 달 안의 날짜를 기본값으로 (이번 달이면 오늘)
    const workDate = todayYmd.startsWith(month) ? todayYmd : `${month}-01`
    setEditing(null)
    setForm({ workDate, type: 'OVERTIME', startTime, endTime, totalMinutes: '', reason: '' })
    setFormError('')
    setModalOpen(true)
  }

  async function openEdit(r: OvertimeRecord) {
    if (r.status !== 'PENDING') {
      const ok = await confirm({
        title: '승인된 기록 수정',
        message: '수정하면 기록이 다시 "승인 대기" 상태가 되어 관리자의 재승인이 필요합니다. 계속할까요?',
        confirmText: '수정 계속',
        variant: 'warning',
      })
      if (!ok) return
    }
    setEditing(r)
    setForm({
      workDate: r.workDate,
      type: r.type,
      startTime: formatTime(r.startTime),
      endTime: formatTime(r.endTime),
      totalMinutes: r.startTime && r.endTime ? '' : String(r.totalMinutes ?? ''),
      reason: r.reason || '',
    })
    setFormError('')
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(null)
    setFormError('')
  }

  // 모달이 열려 있는 동안 Esc로 닫고, 뒤 배경이 스크롤되지 않게 한다
  useEffect(() => {
    if (!modalOpen) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal()
    }
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [modalOpen])

  function onTypeChange(newType: OvertimeType) {
    if (!form) return
    // 수정 중에는 저장된 시간을 덮어쓰지 않고 구분만 바꾼다.
    if (editing) {
      setForm({ ...form, type: newType })
      return
    }
    const [startTime, endTime] = defaultTimesFor(newType, defaults)
    setForm({ ...form, type: newType, startTime, endTime, totalMinutes: '' })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setFormError('')

    if (!form.workDate) {
      setFormError('근무일을 입력해주세요')
      return
    }
    const hasStart = !!form.startTime
    const hasEnd = !!form.endTime
    const hasTotal = !!form.totalMinutes.trim()
    if (hasStart !== hasEnd) {
      setFormError('시작 시간과 종료 시간을 모두 입력해주세요')
      return
    }
    if (hasStart && hasTotal) {
      setFormError('근무 시간 또는 총 시간 중 하나만 입력해주세요')
      return
    }
    if (!hasStart && !hasEnd && !hasTotal) {
      setFormError('시작–종료 시간 또는 총 시간을 입력해주세요')
      return
    }
    if (hasStart) {
      const calculated = durationOf(form.type, form.startTime, form.endTime)
      if (calculated === null || calculated <= 0) {
        setFormError('근무 시간은 1분 이상 입력해주세요')
        return
      }
    }
    if (hasTotal) {
      const minutes = Number(form.totalMinutes)
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 24 * 60) {
        setFormError('총 시간은 1분 이상 24시간 이하로 입력해주세요')
        return
      }
    }

    const payload = {
      workDate: form.workDate,
      type: form.type,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      totalMinutes: hasTotal ? Number(form.totalMinutes) : null,
      reason: form.reason,
    }

    setSubmitting(true)
    try {
      if (editing) {
        await updateOvertimeRecord(editing.id, payload)
      } else {
        await createOvertimeRecord(payload)
      }
      // 다른 달에 등록했으면 그 달로 이동해 방금 넣은 기록을 보여준다.
      changeMonth(form.workDate.slice(0, 7))
      setSelectedDate(form.workDate)
      closeModal()
      setError('')
      setReloadKey((key) => key + 1)
    } catch (e: any) {
      setFormError(e.message || '저장에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  async function onDelete(id: number) {
    const ok = await confirm({
      title: '잔업·특근 기록 삭제',
      message: '이 기록을 삭제할까요? 삭제하면 되돌릴 수 없습니다.',
      confirmText: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    setError('')
    try {
      await deleteOvertimeRecord(id)
      setReloadKey((key) => key + 1)
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다')
    }
  }

  // ── 조각 ───────────────────────────────────────────────────

  function typeBadge(type: OvertimeType) {
    return (
      <span
        className={`fl-badge fl-badge-square ot-badge-type ${
          type === 'SPECIAL' ? 'fl-tone-special' : 'fl-tone-primary'
        }`}
      >
        {TYPE_LABEL[type]}
      </span>
    )
  }

  function statusBadge(status: OvertimeStatus) {
    return <span className={`fl-badge ot-badge-status ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
  }

  function reasonCell(r: OvertimeRecord) {
    return (
      <span className="ot-row-reason">
        <span className={`ot-row-reason-text${r.reason ? '' : ' is-empty'}`}>{r.reason || '—'}</span>
        {r.status === 'REJECTED' && r.rejectReason && (
          <span className="ot-reject-note">반려 사유 — {r.rejectReason}</span>
        )}
      </span>
    )
  }

  function actionsCell(r: OvertimeRecord) {
    return (
      <span className="fl-cell-actions ot-row-actions">
        <button className="fl-btn-e" onClick={() => openEdit(r)} title="수정" aria-label="수정">
          ✎
        </button>
        {r.status !== 'APPROVED' && (
          <button className="fl-btn-x" onClick={() => onDelete(r.id)} title="삭제" aria-label="삭제">
            ×
          </button>
        )}
      </span>
    )
  }

  const viewToggle = (
    <div className="fl-seg" role="group" aria-label="보기 방식">
      <button
        type="button"
        className={`fl-seg-btn${view === 'list' ? ' is-active' : ''}`}
        aria-pressed={view === 'list'}
        onClick={() => setView('list')}
      >
        목록
      </button>
      <button
        type="button"
        className={`fl-seg-btn${view === 'calendar' ? ' is-active' : ''}`}
        aria-pressed={view === 'calendar'}
        onClick={() => setView('calendar')}
      >
        달력
      </button>
    </div>
  )

  const statusFilterControls = (
    <div className="fl-seg" role="group" aria-label="승인 상태 필터">
      {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as StatusFilter[]).map((status) => (
        <button
          key={status}
          type="button"
          className={`fl-seg-btn${statusFilter === status ? ' is-active' : ''}`}
          aria-pressed={statusFilter === status}
          onClick={() => setStatusFilter(status)}
        >
          {status === 'ALL' ? '전체' : STATUS_LABEL[status]}
        </button>
      ))}
    </div>
  )

  const typeFilterControl = (
    <select
      className="fl-input"
      value={typeFilter}
      onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
      aria-label="구분 필터"
    >
      <option value="ALL">구분 전체</option>
      <option value="OVERTIME">잔업</option>
      <option value="SPECIAL">특근</option>
    </select>
  )

  const duration = form ? durationOf(form.type, form.startTime, form.endTime) : null

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>잔업 / 특근</h1>
          <p>평일 연장근무와 휴일·주말 근무를 등록하면 관리자 승인 후 반영됩니다.</p>
        </div>
        <button className="fl-btn fl-btn-primary" onClick={openCreate}>
          기록 등록
        </button>
      </div>

      {error && (
        <div className="fl-error" style={{ marginBottom: 16 }} role="alert">
          {error}
        </div>
      )}
      {loadError && (
        <div className="fl-error ot-load-error" role="alert">
          <span>{loadError}</span>
          <button className="fl-btn fl-btn-sm" onClick={() => setReloadKey((key) => key + 1)}>
            다시 시도
          </button>
        </div>
      )}

      <div className="fl-stat-grid">
        <div className="fl-stat">
          <div className="fl-stat-label">이번 달 잔업</div>
          <div className="fl-stat-value">
            <span className="fl-stat-num">{Math.floor(stats.overtimeMinutes / 60)}</span>
            <span className="fl-stat-unit">시간</span>
            {stats.overtimeMinutes % 60 > 0 && (
              <>
                <span className="fl-stat-num-sm">{stats.overtimeMinutes % 60}</span>
                <span className="fl-stat-unit">분</span>
              </>
            )}
          </div>
          <div className="fl-stat-sub">{stats.overtimeDays}일 · 저녁 휴게 30분 차감</div>
        </div>

        <div className="fl-stat">
          <div className="fl-stat-label">이번 달 특근</div>
          <div className="fl-stat-value">
            <span className="fl-stat-num">{Math.floor(stats.specialMinutes / 60)}</span>
            <span className="fl-stat-unit">시간</span>
            {stats.specialMinutes % 60 > 0 && (
              <>
                <span className="fl-stat-num-sm">{stats.specialMinutes % 60}</span>
                <span className="fl-stat-unit">분</span>
              </>
            )}
          </div>
          <div className="fl-stat-sub">
            {stats.specialDays}일 · 6시간 이상 휴게 1시간 차감
          </div>
        </div>

        <div className="fl-stat">
          <div className="fl-stat-label">승인 대기</div>
          <div className="fl-stat-value">
            <span className={`fl-stat-num${stats.pendingCount > 0 ? ' fl-tone-warn' : ''}`}>
              {stats.pendingCount}
            </span>
            <span className="fl-stat-unit">건</span>
          </div>
          <div className="fl-stat-sub">
            {stats.oldestPending ? `가장 오래된 요청 ${formatWorkDate(stats.oldestPending)}` : '대기 중인 요청 없음'}
          </div>
        </div>

        <div className="fl-stat">
          <div className="fl-stat-label">승인 합계</div>
          <div className="fl-stat-value">
            <span className="fl-stat-num">{Math.floor(stats.approvedMinutes / 60)}</span>
            <span className="fl-stat-unit">시간</span>
            {stats.approvedMinutes % 60 > 0 && (
              <>
                <span className="fl-stat-num-sm">{stats.approvedMinutes % 60}</span>
                <span className="fl-stat-unit">분</span>
              </>
            )}
          </div>
          <div className="fl-stat-sub">{formatMonthLabel(month)} 기준</div>
        </div>
      </div>

      {view === 'list' ? (
        <section className="fl-card">
          <div className="fl-card-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="fl-card-title">등록 내역</span>
              <span className="fl-card-count">총 {filtered.length}건</span>
            </div>
            <div className="ot-filters">
              {statusFilterControls}
              {typeFilterControl}
              <input
                type="month"
                className="fl-input"
                value={month}
                onChange={(e) => e.target.value && changeMonth(e.target.value)}
                aria-label="조회 월"
              />
              {viewToggle}
            </div>
          </div>

          <div className="fl-card-body fl-flush">
            <div className="fl-th ot-table-head">
              <div>근무일</div>
              <div>구분</div>
              <div>시간</div>
              <div>사유</div>
              <div>상태</div>
              <div style={{ textAlign: 'right' }}>관리</div>
            </div>

            {loading ? (
              <div className="fl-empty" role="status" aria-live="polite">불러오는 중...</div>
            ) : loadError ? (
              <div className="fl-empty">기록을 불러오지 못했습니다. 위의 다시 시도를 눌러주세요.</div>
            ) : filtered.length === 0 ? (
              <div className="fl-empty">조건에 맞는 기록이 없습니다.</div>
            ) : (
              pageRecords.map((r) => (
                <div key={r.id} className="fl-tr ot-row">
                  <span className="ot-row-date">{formatWorkDate(r.workDate)}</span>
                  {typeBadge(r.type)}
                  <span className="ot-row-time">{workTimeText(r)}</span>
                  {reasonCell(r)}
                  {statusBadge(r.status)}
                  {actionsCell(r)}
                </div>
              ))
            )}
          </div>

          <Pager page={currentPage} totalPages={totalPages} onChange={setPage} disabled={loading} />
        </section>
      ) : (
        <section className="fl-card">
          <div className="fl-card-head">
            <div className="ot-cal-nav">
              <button
                className="fl-btn-icon fl-btn-sm"
                onClick={() => changeMonth(shiftMonth(month, -1))}
                aria-label="이전 달"
              >
                ◀
              </button>
              <span className="ot-cal-month" aria-live="polite">{formatMonthLabel(month)}</span>
              <button
                className="fl-btn-icon fl-btn-sm"
                onClick={() => changeMonth(shiftMonth(month, 1))}
                aria-label="다음 달"
              >
                ▶
              </button>
              <button
                className="fl-btn fl-btn-sm"
                onClick={() => {
                  changeMonth(monthKey(new Date()))
                  setSelectedDate(todayYmd)
                }}
              >
                오늘
              </button>
            </div>
            <div className="ot-legend">
              <span className="ot-legend-item">
                <i className="ot-legend-dot" />
                잔업
              </span>
              <span className="ot-legend-item">
                <i className="ot-legend-dot fl-dot-special" />
                특근
              </span>
              {viewToggle}
            </div>
            <div className="ot-filters">
              {statusFilterControls}
              {typeFilterControl}
            </div>
          </div>

          <div className="ot-cal-body">
            <div className="fl-cal-grid" style={{ marginBottom: 4 }}>
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={`fl-cal-wd${i === 0 ? ' fl-sun' : i === 6 ? ' fl-sat' : ''}`}
                >
                  {w}
                </div>
              ))}
            </div>
            <div className="fl-cal-grid">
              {calendarCells.map((cell) => {
                const dayRecords = recordsByDate[cell.date] || []
                const cls = [
                  'fl-day',
                  'ot-day',
                  cell.dow === 0 ? 'fl-sun' : '',
                  cell.dow === 6 ? 'fl-sat' : '',
                  cell.inMonth ? '' : 'is-outside',
                  cell.date === todayYmd ? 'is-today' : '',
                  cell.date === selectedDate ? 'is-selected' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <button
                    key={cell.date}
                    className={cls}
                    aria-label={formatLongDate(cell.date)}
                    aria-pressed={cell.date === selectedDate}
                    onClick={() => {
                      // 앞뒤 달 칸을 누르면 그 달로 넘어가야 선택한 날이 계속 보인다
                      if (!cell.inMonth) changeMonth(cell.date.slice(0, 7))
                      setSelectedDate(cell.date)
                    }}
                  >
                    {cell.day}
                    {dayRecords.length > 0 && (
                      <span className="fl-day-dots">
                        {dayRecords.slice(0, 4).map((r) => (
                          <i
                            key={r.id}
                            className={`fl-day-dot${r.type === 'SPECIAL' ? ' fl-dot-special' : ''}`}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="ot-day-panel-head">
            <span className="ot-day-panel-date">{formatLongDate(selectedDate)}</span>
            <span className="ot-day-panel-count">
              {selectedRecords.length}건{selectedRecords.length > 0 && ` · ${formatMinutes(selectedMinutes)}`}
            </span>
          </div>

          <div className="fl-card-body fl-flush" style={{ paddingBottom: 8 }}>
            {loading ? (
              <div className="fl-empty" role="status" aria-live="polite">불러오는 중...</div>
            ) : loadError ? (
              <div className="fl-empty">기록을 불러오지 못했습니다. 위의 다시 시도를 눌러주세요.</div>
            ) : selectedRecords.length === 0 ? (
              <div className="fl-empty">이 날짜에 등록된 기록이 없습니다.</div>
            ) : (
              selectedRecords.map((r) => (
                <div key={r.id} className="fl-tr ot-day-row">
                  {typeBadge(r.type)}
                  <span className="ot-row-time">{workTimeText(r)}</span>
                  {reasonCell(r)}
                  {statusBadge(r.status)}
                  {actionsCell(r)}
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {modalOpen && form && (
        <div
          className="fl-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal()
          }}
        >
          <form className="fl-modal" onSubmit={onSubmit} role="dialog" aria-modal="true">
            <div className="fl-modal-head">
              <div className="fl-modal-heading">
                <span className="fl-modal-title">{editing ? '기록 수정' : '새 기록 등록'}</span>
                <span className="fl-modal-sub">등록하면 승인 대기 상태로 관리자에게 전달됩니다.</span>
              </div>
              <button type="button" className="fl-modal-close" onClick={closeModal} aria-label="닫기">
                ✕
              </button>
            </div>

            <div className="fl-modal-body">
              <div className="fl-field">
                <span className="fl-field-label">구분</span>
                <div className="ot-choice-grid">
                  <button
                    type="button"
                    className={`ot-choice${form.type === 'OVERTIME' ? ' is-active' : ''}`}
                    onClick={() => onTypeChange('OVERTIME')}
                  >
                    <span className="ot-choice-name">잔업</span>
                    <span className="ot-choice-sub">
                      평일 연장근무
                      {defaults && ` · 기본 ${formatTime(defaults.overtimeStart)}–${formatTime(defaults.overtimeEnd)}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`ot-choice ot-choice-special${form.type === 'SPECIAL' ? ' is-active' : ''}`}
                    onClick={() => onTypeChange('SPECIAL')}
                  >
                    <span className="ot-choice-name">특근</span>
                    <span className="ot-choice-sub">
                      휴일·주말 근무
                      {defaults && ` · 기본 ${formatTime(defaults.specialStart)}–${formatTime(defaults.specialEnd)}`}
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
                    value={form.workDate}
                    onChange={(e) => setForm({ ...form, workDate: e.target.value })}
                    required
                  />
                </label>
                <label className="fl-field">
                  <span className="fl-field-label">
                    총 시간 <span className="fl-optional">(시간 미입력 시)</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={24 * 60}
                    step={1}
                    className="fl-input"
                    placeholder="예: 120분"
                    value={form.totalMinutes}
                    onChange={(e) =>
                      setForm({ ...form, totalMinutes: e.target.value, startTime: '', endTime: '' })
                    }
                  />
                </label>
              </div>

              <div className="fl-field">
                <span className="fl-field-label">
                  근무 시간
                  {duration !== null && <span className="ot-duration">{formatMinutes(duration)}</span>}
                </span>
                <div className="fl-range">
                  <input
                    type="time"
                    className="fl-input"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value, totalMinutes: '' })}
                  />
                  <span className="fl-range-sep">–</span>
                  <input
                    type="time"
                    className="fl-input"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value, totalMinutes: '' })}
                  />
                </div>
              </div>

              <label className="fl-field">
                <span className="fl-field-label">
                  사유 <span className="fl-optional">(선택)</span>
                </span>
                <textarea
                  className="fl-input fl-textarea"
                  placeholder="어떤 업무였는지 간단히 적어주세요"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </label>

              <div className="fl-hint">
                저녁 휴게시간 17:00~17:30에 걸친 시간은 총 근무시간에서 자동 차감됩니다.
                {form.type === 'SPECIAL' &&
                  ' 특근은 6시간 이상 근무 시 점심 휴게시간 1시간도 함께 차감됩니다.'}
              </div>

              {formError && <div className="fl-error">{formError}</div>}
            </div>

            <div className="fl-modal-foot">
              <span className="fl-modal-foot-note">승인 후 수정하면 다시 대기 상태가 됩니다.</span>
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn" onClick={closeModal}>
                  취소
                </button>
                <button type="submit" className="fl-btn fl-btn-primary" disabled={submitting}>
                  {submitting ? '저장 중...' : editing ? '수정 저장' : '등록'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
