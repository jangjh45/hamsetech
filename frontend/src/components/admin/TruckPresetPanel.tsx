import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createTruckPreset,
  deleteTruckPreset,
  getTruckPresets,
  updateTruckPreset,
  type TruckPreset,
  type TruckPresetRequest,
} from '../../api/truckPresets'
import { useConfirm } from '../ConfirmDialog'
import '../../styles/truckPresets.css'

interface FormState {
  label: string
  width: string
  height: string
  sortOrder: string
}

const EMPTY_FORM: FormState = { label: '', width: '', height: '', sortOrder: '' }

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '')
}

/**
 * 관리자 화면의 적재함 프리셋 편집. 적재 시뮬레이터의 프리셋 버튼이 이 목록을 따른다.
 */
export default function TruckPresetPanel({
  onError,
  onNotice,
}: {
  onError: (message: string) => void
  onNotice: (message: string) => void
}) {
  const { confirm } = useConfirm()
  const [presets, setPresets] = useState<TruckPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  // 새 프리셋을 넣을 때 정렬 순서를 비워 두면 맨 뒤에 붙는다
  const nextSortOrder = presets.reduce((max, p) => Math.max(max, p.sortOrder + 1), 0)

  const load = useCallback(async () => {
    try {
      setPresets(await getTruckPresets())
    } catch (e: any) {
      onError(e?.message || '프리셋 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError('')
  }

  function startEdit(preset: TruckPreset) {
    setEditingId(preset.id)
    setForm({
      label: preset.label,
      width: String(preset.width),
      height: String(preset.height),
      sortOrder: String(preset.sortOrder),
    })
    setFormError('')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const label = form.label.trim()
    const width = Number(form.width)
    const height = Number(form.height)
    if (!label) {
      setFormError('프리셋 이름을 입력해주세요.')
      return
    }
    if (!(width > 0) || !(height > 0)) {
      setFormError('가로와 세로 크기를 입력해주세요.')
      return
    }

    const request: TruckPresetRequest = {
      label,
      width,
      height,
      sortOrder: form.sortOrder === '' ? nextSortOrder : Number(form.sortOrder),
    }

    setSaving(true)
    setFormError('')
    try {
      if (editingId !== null) {
        await updateTruckPreset(editingId, request)
        onNotice('프리셋을 수정했습니다.')
      } else {
        await createTruckPreset(request)
        onNotice('프리셋을 추가했습니다.')
      }
      resetForm()
      await load()
    } catch (err: any) {
      setFormError(err?.message || '프리셋 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(preset: TruckPreset) {
    const ok = await confirm({
      title: '프리셋 삭제',
      message: `“${preset.label}” 프리셋을 삭제할까요? 이미 저장된 시나리오에는 영향이 없습니다.`,
      confirmText: '삭제',
      variant: 'danger',
    })
    if (!ok) return

    try {
      await deleteTruckPreset(preset.id)
      if (editingId === preset.id) resetForm()
      onNotice('프리셋을 삭제했습니다.')
      await load()
    } catch (err: any) {
      onError(err?.message || '프리셋 삭제에 실패했습니다.')
    }
  }

  return (
    <section className="fl-card">
      <div className="fl-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="fl-card-title">적재함 프리셋</span>
          <span className="fl-card-count">{presets.length}개</span>
        </div>
      </div>
      <div className="fl-card-body">
        <p className="fl-hint">
          적재 시뮬레이터의 프리셋 버튼이 이 목록을 따릅니다. 저장된 시나리오는 저장할 때의 치수를 그대로 지니므로
          여기서 바꾸거나 지워도 영향을 받지 않습니다.
        </p>

        <form className="ad-preset-form" onSubmit={handleSubmit}>
          <label className="fl-field">
            <span className="fl-field-label">이름</span>
            <input
              className="fl-input"
              value={form.label}
              maxLength={50}
              placeholder="예: 3.5톤 카고"
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </label>
          <label className="fl-field">
            <span className="fl-field-label">가로 (mm)</span>
            <input
              className="fl-input"
              inputMode="numeric"
              value={form.width}
              onChange={(e) => setForm({ ...form, width: digitsOnly(e.target.value) })}
            />
          </label>
          <label className="fl-field">
            <span className="fl-field-label">세로 (mm)</span>
            <input
              className="fl-input"
              inputMode="numeric"
              value={form.height}
              onChange={(e) => setForm({ ...form, height: digitsOnly(e.target.value) })}
            />
          </label>
          <label className="fl-field">
            <span className="fl-field-label">정렬 순서</span>
            <input
              className="fl-input"
              inputMode="numeric"
              value={form.sortOrder}
              placeholder={String(nextSortOrder)}
              onChange={(e) => setForm({ ...form, sortOrder: digitsOnly(e.target.value) })}
            />
          </label>
          <div className="ad-preset-form-actions">
            {editingId !== null && (
              <button type="button" className="fl-btn" onClick={resetForm}>
                취소
              </button>
            )}
            <button type="submit" className="fl-btn fl-btn-primary" disabled={saving}>
              {editingId !== null ? '수정 저장' : '프리셋 추가'}
            </button>
          </div>
        </form>

        {formError && <div className="fl-error">{formError}</div>}

        {!loading && presets.length === 0 && <div className="fl-empty">등록된 프리셋이 없습니다.</div>}
        {presets.length > 0 && (
          <table className="ad-preset-table">
            <thead>
              <tr>
                <th>순서</th>
                <th>이름</th>
                <th>가로 × 세로 (mm)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {presets.map((preset) => (
                <tr key={preset.id} className={editingId === preset.id ? 'is-editing' : undefined}>
                  <td>{preset.sortOrder}</td>
                  <td>{preset.label}</td>
                  <td>
                    {preset.width} × {preset.height}
                  </td>
                  <td className="ad-preset-actions">
                    <button className="fl-btn fl-btn-sm" onClick={() => startEdit(preset)}>
                      수정
                    </button>
                    <button className="fl-btn fl-btn-sm" onClick={() => void handleDelete(preset)}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
