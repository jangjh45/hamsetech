import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createVendorCategory,
  listAllVendorCategories,
  updateVendorCategory,
  type VendorCategory,
} from '../../api/vendors'

/**
 * 관리자 화면의 업체 분류 편집. 업체 등록 화면에는 사용 중인 분류만 나타난다.
 */
export default function VendorCategoryPanel({
  onError,
  onNotice,
}: {
  onError: (message: string) => void
  onNotice: (message: string) => void
}) {
  const [categories, setCategories] = useState<VendorCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const all = await listAllVendorCategories()
      setCategories(all)
      setDrafts(Object.fromEntries(all.map((category) => [category.id, category.name])))
    } catch (err) {
      onError(err instanceof Error ? err.message : '분류 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void load()
  }, [load])

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    try {
      await createVendorCategory(newName)
      setNewName('')
      onNotice('분류를 추가했습니다.')
      await load()
    } catch (err) {
      onError(err instanceof Error ? err.message : '분류를 추가하지 못했습니다.')
    }
  }

  async function saveCategory(category: VendorCategory, active = category.active) {
    setSavingId(category.id)
    try {
      await updateVendorCategory(category.id, {
        name: drafts[category.id] ?? category.name,
        active,
      })
      onNotice(active === category.active ? '분류 이름을 저장했습니다.' : active ? '분류를 다시 사용합니다.' : '분류를 사용 중지했습니다.')
      await load()
    } catch (err) {
      onError(err instanceof Error ? err.message : '분류를 저장하지 못했습니다.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="fl-card">
      <div className="fl-card-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="fl-card-title">업체 분류</span>
          <span className="fl-card-count">{categories.length}개</span>
        </div>
      </div>
      <div className="fl-card-body ad-category-body">
        <p className="fl-hint">업체 등록 화면에는 사용 중인 분류만 표시됩니다.</p>

        <form className="ad-category-add" onSubmit={addCategory}>
          <label className="fl-field">
            <span className="fl-field-label">새 분류</span>
            <input
              className="fl-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              maxLength={80}
              placeholder="예: 안전용품"
              required
            />
          </label>
          <button className="fl-btn fl-btn-primary" type="submit">분류 추가</button>
        </form>

        <div className="ad-category-list">
          {loading ? null : categories.map((category) => (
            <div className={`ad-category-row${category.active ? '' : ' is-inactive'}`} key={category.id}>
              <input
                className="fl-input"
                aria-label={`${category.name} 분류명`}
                value={drafts[category.id] ?? category.name}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [category.id]: event.target.value }))
                }
                maxLength={80}
              />
              {!category.active && <span className="fl-badge">사용 중지</span>}
              <button
                className="fl-btn fl-btn-sm"
                onClick={() => void saveCategory(category)}
                disabled={savingId === category.id}
              >
                이름 저장
              </button>
              <button
                className="fl-btn fl-btn-sm"
                onClick={() => void saveCategory(category, !category.active)}
                disabled={savingId === category.id}
              >
                {category.active ? '사용 중지' : '다시 사용'}
              </button>
            </div>
          ))}
          {!loading && categories.length === 0 && <div className="fl-empty">등록된 분류가 없습니다.</div>}
        </div>
      </div>
    </section>
  )
}
