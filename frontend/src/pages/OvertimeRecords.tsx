import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createOvertimeRecord,
  deleteOvertimeRecord,
  listMyOvertimeRecords,
  updateOvertimeRecord,
  type OvertimeRecord,
  type OvertimeType,
} from '../api/overtimeRecords'
import { formatDate } from '../utils/formatDate'

const STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '반려',
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#b58900',
  APPROVED: '#2e7d32',
  REJECTED: '#c62828',
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

export default function OvertimeRecordsPage() {
  const [records, setRecords] = useState<OvertimeRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormState>(emptyForm())
  const [editingId, setEditingId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)

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

  async function onDelete(id: number) {
    setError('')
    try {
      await deleteOvertimeRecord(id)
      await load()
    } catch (e: any) {
      setError(e.message || '삭제에 실패했습니다')
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 16 }}>
      <h1>잔업/특근 기록</h1>
      <p className="subtitle">잔업(평일 연장근무)과 특근(휴일/주말 근무)을 등록하면 관리자 승인 후 반영됩니다.</p>

      {error && (
        <div className="card" style={{ borderColor: '#c62828', color: '#c62828', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <form onSubmit={onSubmit} className="card" style={{ marginBottom: 24, display: 'grid', gap: 12 }}>
        <h3 style={{ margin: 0 }}>{editingId != null ? '기록 수정' : '새 기록 등록'}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          <label>
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
          <label>
            구분
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as OvertimeType })}
              style={{ width: '100%' }}
            >
              <option value="OVERTIME">잔업 (평일 연장근무)</option>
              <option value="SPECIAL">특근 (휴일/주말 근무)</option>
            </select>
          </label>
          <label>
            시작 시간
            <input
              type="time"
              className="input"
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value, totalMinutes: '' })}
              style={{ width: '100%' }}
            />
          </label>
          <label>
            종료 시간
            <input
              type="time"
              className="input"
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value, totalMinutes: '' })}
              style={{ width: '100%' }}
            />
          </label>
          <label>
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
        <label>
          사유
          <textarea
            className="input"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            style={{ width: '100%', minHeight: 60 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" type="submit" disabled={submitting}>
            {editingId != null ? '수정 저장' : '등록'}
          </button>
          {editingId != null && (
            <button className="btn ghost" type="button" onClick={cancelEdit}>취소</button>
          )}
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 16 }}>불러오는 중...</div>
        ) : records.length === 0 ? (
          <div style={{ padding: 16 }}>등록된 기록이 없습니다.</div>
        ) : (
          records.map((r) => (
            <div key={r.id} style={{ padding: 16, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 600 }}>
                  {formatDate(r.workDate)} · {TYPE_LABEL[r.type]}
                  <span style={{ marginLeft: 8, color: STATUS_COLOR[r.status], fontSize: 13 }}>
                    ● {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                  {r.startTime && r.endTime ? `${r.startTime} ~ ${r.endTime}` : `${r.totalMinutes}분`}
                  {r.reason ? ` · ${r.reason}` : ''}
                </div>
                {r.status === 'REJECTED' && r.rejectReason && (
                  <div style={{ color: '#c62828', fontSize: 13 }}>반려 사유: {r.rejectReason}</div>
                )}
              </div>
              {r.status === 'PENDING' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn ghost" onClick={() => startEdit(r)}>수정</button>
                  <button className="btn ghost" onClick={() => onDelete(r.id)}>삭제</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
