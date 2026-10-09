import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiFetch } from '../../api/client'
import { createOvertimeRecordsBulk, type OvertimeBulkResult, type OvertimeDefaults, type OvertimeType } from '../../api/overtimeRecords'
import { formatMinutes, formatTime, toYmd } from '../../utils/formatDate'
import { defaultTimesFor, durationOf } from '../../utils/overtime'

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
export default function OvertimeBulkModal({
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