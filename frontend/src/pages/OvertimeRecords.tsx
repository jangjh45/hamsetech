import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createOvertimeRecord,
  deleteOvertimeRecord,
  getOvertimeDefaults,
  listMyOvertimeRecords,
  updateOvertimeRecord,
  type OvertimeDefaults,
  type OvertimeRecord,
  type OvertimeType,
} from '../api/overtimeRecords'
import { formatDate } from '../utils/formatDate'
import '../styles/overtime.css'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

const STATUS_PILL: Record<string, string> = {
  PENDING: 'ot-pill ot-pill--pending',
  APPROVED: 'ot-pill ot-pill--approved',
  REJECTED: 'ot-pill ot-pill--rejected',
}

const TYPE_LABEL: Record<string, string> = {
  OVERTIME: '잔업',
  SPECIAL: '특근',
}

interface FormState {
  workDate: string
  type: OvertimeType
  startTime: string
  endTime: string
  totalMinutes: string
  reason: string
}

function emptyForm(): FormState {
  return { workDate: '', type: 'OVERTIME', startTime: '', endTime: '', totalMinutes: '', reason: '' }
}

function defaultTimesFor(type: OvertimeType, defaults: OvertimeDefaults | null): [string, string] {
  if (!defaults) return ['', '']
  return type === 'SPECIAL'
    ? [defaults.specialStart, defaults.specialEnd]
    : [defaults.overtimeStart, defaults.overtimeEnd]
}

export default function OvertimeRecordsPage() {
  const [records, setRecords] = useState<OvertimeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [defaults, setDefaults] = useState<OvertimeDefaults | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listMyOvertimeRecords()
      setRecords(list)
    } catch (e: any) {
      setError(e.message || '목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // 구분별 기본 근무시간을 불러와, 새 기록 작성 중이고 시간 칸이 비어 있으면 현재 구분값으로 채운다.
  useEffect(() => {
    getOvertimeDefaults()
      .then((d) => {
        setDefaults(d)
        setForm((prev) => {
          if (editingId != null) return prev
          if (prev.startTime || prev.endTime || prev.totalMinutes) return prev
          const [start, end] = defaultTimesFor(prev.type, d)
          return { ...prev, startTime: start, endTime: end }
        })
      })
      .catch(() => { /* 기본시간은 편의 기능이라 실패해도 폼은 정상 동작 */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startEdit(r: OvertimeRecord) {
    setEditingId(r.id)
    setForm({
      workDate: r.workDate,
      type: r.type,
      startTime: r.startTime || '',
      endTime: r.endTime || '',
      totalMinutes: r.startTime && r.endTime ? '' : String(r.totalMinutes ?? ''),
      reason: r.reason || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm())
  }

  function onTypeChange(newType: OvertimeType) {
    // 수정 모드에서는 저장된 시간을 덮어쓰지 않고 구분만 바꾼다.
    if (editingId != null) {
      setForm({ ...form, type: newType })
      return
    }
    // 새 기록 등록 시에는 선택한 구분의 기본 시간을 채운다.
    const [start, end] = defaultTimesFor(newType, defaults)
    setForm({ ...form, type: newType, startTime: start, endTime: end, totalMinutes: '' })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!form.workDate) { setError('날짜를 입력해주세요'); return }
    if (!form.startTime && !form.endTime && !form.totalMinutes) {
      setError('시작-종료 시간 또는 총 시간을 입력해주세요')
      return
    }

    const payload = {
      workDate: form.workDate,
      type: form.type,
      startTime: form.startTime || null,
      endTime: form.endTime || null,
      totalMinutes: form.totalMinutes ? Number(form.totalMinutes) : null,
      reason: form.reason,
    }

    setSubmitting(true)
    try {
      if (editingId != null) {
        await updateOvertimeRecord(editingId, payload)
      } else {
        await createOvertimeRecord(payload)
      }
      cancelEdit()
      await load()
    } catch (e: any) {
      setError(e.message || '저장에 실패했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  function onEditClick(r: OvertimeRecord) {
    if (r.status !== 'PENDING') {
      const ok = window.confirm('수정하면 다시 "승인 대기" 상태가 되어 관리자 재승인이 필요합니다. 계속할까요?')
      if (!ok) return
    }
    startEdit(r)
  }

  async function onDelete(id: number) {
    setError('')
    if (!window.confirm('이 기록을 삭제할까요?')) return
    try {
      await deleteOvertimeRecord(id)
      await load()
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다')
    }
  }

  return (
    <div className="container">
      <h1 className="title">잔업/특근 기록</h1>
      <p className="subtitle">잔업(평일 연장근무)과 특근(휴일/주말 근무)을 등록하면 관리자 승인 후 반영됩니다.</p>

      {error && <div className="ot-alert">⚠️ {error}</div>}

      <form
        onSubmit={onSubmit}
        className={`card ot-form${editingId != null ? ' ot-form--editing' : ''}`}
        style={{ marginBottom: 24 }}
      >
        <h3 className="ot-form__title">
          {editingId != null ? '✏️ 기록 수정' : '➕ 새 기록 등록'}
        </h3>
        <div className="ot-form__grid">
          <label className="ot-form__label">
            날짜
            <input
              type="date"
              className="input"
              value={form.workDate}
              onChange={(e) => setForm({ ...form, workDate: e.target.value })}
              required
              style={{ width: '100%' }}
            />
          </label>
          <label className="ot-form__label">
            구분
            <select
              className="input"
              value={form.type}
              onChange={(e) => onTypeChange(e.target.value as OvertimeType)}
              style={{ width: '100%' }}
            >
              <option value="OVERTIME">잔업 (평일 연장근무)</option>
              <option value="SPECIAL">특근 (휴일/주말 근무)</option>
            </select>
          </label>
          <label className="ot-form__label">
            시작 시간
            <input
              type="time"
              className="input"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value, totalMinutes: '' })}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ot-form__label">
            종료 시간
            <input
              type="time"
              className="input"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value, totalMinutes: '' })}
              style={{ width: '100%' }}
            />
          </label>
          <label className="ot-form__label">
            또는 총 시간(분)
            <input
              type="number"
              min={0}
              className="input"
              placeholder="예: 120"
              value={form.totalMinutes}
              onChange={(e) => setForm({ ...form, totalMinutes: e.target.value, startTime: '', endTime: '' })}
              style={{ width: '100%' }}
            />
          </label>
        </div>
        {form.type === 'SPECIAL' && (
          <div className="ot-hint">
            <span>💡</span>
            <span>특근은 6시간 이상 근무 시 점심 휴게시간 1시간이 총 근무시간에서 자동 차감됩니다.</span>
          </div>
        )}
        <label className="ot-form__label">
          사유
          <textarea
            className="input"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            placeholder="사유를 입력하세요 (선택)"
            style={{ width: '100%', minHeight: 60 }}
          />
        </label>
        <div className="ot-form__footer">
          {editingId != null && (
            <button className="btn ghost" type="button" onClick={cancelEdit}>취소</button>
          )}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? '저장 중...' : editingId != null ? '수정 저장' : '등록'}
          </button>
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="ot-list-head">
          <h3>등록 내역</h3>
          {!loading && records.length > 0 && <span className="ot-count">총 {records.length}건</span>}
        </div>
        {loading ? (
          <div className="ot-empty">불러오는 중...</div>
        ) : records.length === 0 ? (
          <div className="ot-empty">아직 등록된 기록이 없습니다.</div>
        ) : (
          records.map((r) => (
            <div key={r.id} className="ot-record">
              <div className="ot-record__main">
                <div className="ot-record__head">
                  <span className="ot-record__date">{formatDate(r.workDate)}</span>
                  <span className={`ot-tag${r.type === 'SPECIAL' ? ' ot-tag--special' : ''}`}>
                    {TYPE_LABEL[r.type]}
                  </span>
                  <span className={STATUS_PILL[r.status]}>{STATUS_LABEL[r.status]}</span>
                </div>
                <div className="ot-record__meta">
                  🕒 {r.startTime && r.endTime ? `${r.startTime} ~ ${r.endTime}` : `${r.totalMinutes}분`}
                  {r.reason ? ` · ${r.reason}` : ''}
                </div>
                {r.status === 'REJECTED' && r.rejectReason && (
                  <div className="ot-record__reject">반려 사유: {r.rejectReason}</div>
                )}
              </div>
              <div className="ot-actions">
                <button className="btn ghost" onClick={() => onEditClick(r)}>수정</button>
                {r.status !== 'APPROVED' && (
                  <button className="btn ghost ot-danger" onClick={() => onDelete(r.id)}>삭제</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
