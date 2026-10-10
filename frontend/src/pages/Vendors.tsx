import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { isAdmin } from '../auth/token'
import Pager from '../components/Pager'
import {
  createVendor,
  createVendorCategory,
  getVendor,
  listAllVendorCategories,
  listVendorCategories,
  listVendors,
  updateVendor,
  updateVendorCategory,
  type Vendor,
  type VendorCategory,
  type VendorContactInput,
  type VendorInput,
  type VendorPage,
  type VendorSummary,
} from '../api/vendors'
import '../styles/vendors.css'

const PAGE_SIZE = 20

type VendorDraft = VendorInput

function emptyDraft(categoryId = 0): VendorDraft {
  return {
    name: '',
    categoryId,
    businessRegistrationNo: '',
    mainPhone: '',
    mainEmail: '',
    address: '',
    website: '',
    memo: '',
    contacts: [],
  }
}

function draftFromVendor(vendor: Vendor): VendorDraft {
  return {
    name: vendor.name,
    categoryId: vendor.categoryId,
    businessRegistrationNo: vendor.businessRegistrationNo ?? '',
    mainPhone: vendor.mainPhone ?? '',
    mainEmail: vendor.mainEmail ?? '',
    address: vendor.address ?? '',
    website: vendor.website ?? '',
    memo: vendor.memo ?? '',
    contacts: vendor.contacts.map((contact) => ({ ...contact })),
  }
}

function phoneHref(value: string): string {
  return `tel:${value.replace(/[^\d+]/g, '')}`
}

export default function VendorsPage() {
  const admin = isAdmin()
  const [pageData, setPageData] = useState<VendorPage | null>(null)
  const [categories, setCategories] = useState<VendorCategory[]>([])
  const [managedCategories, setManagedCategories] = useState<VendorCategory[]>([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<number | ''>('')
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [details, setDetails] = useState<Vendor | null>(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingCategory, setEditingCategory] = useState<VendorCategory | null>(null)
  const [draft, setDraft] = useState<VendorDraft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [showCategoryManager, setShowCategoryManager] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categoryDrafts, setCategoryDrafts] = useState<Record<number, string>>({})
  const [savingCategoryId, setSavingCategoryId] = useState<number | null>(null)

  const load = useCallback(async (nextPage: number, q: string, selectedCategory: number | '') => {
    setLoading(true)
    setError('')
    try {
      const result = await listVendors(nextPage, PAGE_SIZE, q, selectedCategory || undefined)
      setPageData(result)
      setPage(result.number)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업체 목록을 불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [])

  const refreshCategories = useCallback(async () => {
    const active = await listVendorCategories()
    setCategories(active)
    if (admin) {
      const all = await listAllVendorCategories()
      setManagedCategories(all)
      setCategoryDrafts(Object.fromEntries(all.map((category) => [category.id, category.name])))
    }
  }, [admin])

  useEffect(() => {
    // 초기 진입 시 서버 목록을 동기화한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(0, '', '')
    refreshCategories().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : '분류 목록을 불러오지 못했습니다.')
    })
  }, [load, refreshCategories])

  const formCategories = useMemo(() => {
    if (!editingCategory || categories.some((category) => category.id === editingCategory.id)) return categories
    return [...categories, editingCategory].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  }, [categories, editingCategory])

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void load(0, query, categoryId)
  }

  function goToPage(nextPage: number) {
    void load(nextPage, query, categoryId)
  }

  async function openDetails(item: VendorSummary) {
    setDetailsLoading(true)
    setDetails(null)
    setError('')
    try {
      setDetails(await getVendor(item.id))
    } catch (err) {
      setError(err instanceof Error ? err.message : '업체 정보를 불러오지 못했습니다.')
    } finally {
      setDetailsLoading(false)
    }
  }

  function openCreate() {
    setEditingId(null)
    setEditingCategory(null)
    setDraft(emptyDraft(categories[0]?.id ?? 0))
    setFormError('')
    setFormOpen(true)
  }

  async function openEdit(vendorId: number) {
    setFormError('')
    try {
      const vendor = details?.id === vendorId ? details : await getVendor(vendorId)
      setEditingId(vendor.id)
      setEditingCategory({
        id: vendor.categoryId,
        name: vendor.categoryName,
        active: categories.some((category) => category.id === vendor.categoryId),
      })
      setDraft(draftFromVendor(vendor))
      setFormOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '업체 정보를 불러오지 못했습니다.')
    }
  }

  function closeForm() {
    if (saving) return
    setFormOpen(false)
  }

  async function saveVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setSaving(true)
    try {
      const input: VendorInput = {
        ...draft,
        contacts: draft.contacts.map((contact) => ({ ...contact })),
      }
      if (editingId === null) await createVendor(input)
      else await updateVendor(editingId, input)
      setFormOpen(false)
      setDetails(null)
      await load(page, query, categoryId)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '업체 정보를 저장하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  function updateDraft<K extends keyof VendorDraft>(key: K, value: VendorDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateContact(index: number, changes: Partial<VendorContactInput>) {
    setDraft((current) => ({
      ...current,
      contacts: current.contacts.map((contact, contactIndex) =>
        contactIndex === index ? { ...contact, ...changes } : contact,
      ),
    }))
  }

  function addContact() {
    setDraft((current) => ({
      ...current,
      contacts: [
        ...current.contacts,
        {
          name: '', department: '', position: '', phone: '', mobile: '', email: '', memo: '',
          primary: current.contacts.length === 0,
        },
      ],
    }))
  }

  function removeContact(index: number) {
    setDraft((current) => {
      const contacts = current.contacts.filter((_, contactIndex) => contactIndex !== index)
      if (!contacts.some((contact) => contact.primary) && contacts.length > 0) {
        contacts[0] = { ...contacts[0], primary: true }
      }
      return { ...current, contacts }
    })
  }

  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    try {
      await createVendorCategory(newCategoryName)
      setNewCategoryName('')
      await refreshCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : '분류를 추가하지 못했습니다.')
    }
  }

  async function saveCategory(category: VendorCategory, active = category.active) {
    setSavingCategoryId(category.id)
    setError('')
    try {
      await updateVendorCategory(category.id, {
        name: categoryDrafts[category.id] ?? category.name,
        active,
      })
      await refreshCategories()
    } catch (err) {
      setError(err instanceof Error ? err.message : '분류를 저장하지 못했습니다.')
    } finally {
      setSavingCategoryId(null)
    }
  }

  const items = pageData?.content ?? []

  return (
    <div className="fl-page vd-page">
      <div className="fl-titleband">
        <div>
          <h1>업체 주소록</h1>
          <p>업체와 담당자 연락처를 검색하고 함께 관리합니다.</p>
        </div>
        <div className="vd-title-actions">
          {admin && (
            <button
              className={`fl-btn${showCategoryManager ? ' fl-btn-primary' : ''}`}
              onClick={() => setShowCategoryManager((visible) => !visible)}
            >
              {showCategoryManager ? '분류 관리 닫기' : '분류 관리'}
            </button>
          )}
          <button className="fl-btn fl-btn-primary" onClick={openCreate} disabled={categories.length === 0}>
            업체 등록
          </button>
        </div>
      </div>

      {error && <div className="fl-error" role="alert">{error}</div>}

      {showCategoryManager && admin && (
        <section className="fl-card vd-category-card">
          <div className="fl-card-head">
            <span className="fl-card-title">업체 분류 관리</span>
            <span className="fl-card-count">업체 등록 화면에는 사용 중인 분류만 표시됩니다.</span>
          </div>
          <div className="fl-card-body">
            <form className="vd-category-add" onSubmit={addCategory}>
              <label className="fl-field">
                <span className="fl-field-label">새 분류</span>
                <input
                  className="fl-input"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  maxLength={80}
                  placeholder="예: 안전용품"
                  required
                />
              </label>
              <button className="fl-btn fl-btn-primary" type="submit">분류 추가</button>
            </form>
            <div className="vd-category-list">
              {managedCategories.map((category) => (
                <div className={`vd-category-row${category.active ? '' : ' is-inactive'}`} key={category.id}>
                  <input
                    className="fl-input"
                    aria-label={`${category.name} 분류명`}
                    value={categoryDrafts[category.id] ?? category.name}
                    onChange={(event) =>
                      setCategoryDrafts((current) => ({ ...current, [category.id]: event.target.value }))
                    }
                    maxLength={80}
                  />
                  {!category.active && <span className="fl-badge">사용 중지</span>}
                  <button
                    className="fl-btn fl-btn-sm"
                    onClick={() => void saveCategory(category)}
                    disabled={savingCategoryId === category.id}
                  >
                    이름 저장
                  </button>
                  <button
                    className="fl-btn fl-btn-sm"
                    onClick={() => void saveCategory(category, !category.active)}
                    disabled={savingCategoryId === category.id}
                  >
                    {category.active ? '사용 중지' : '다시 사용'}
                  </button>
                </div>
              ))}
              {managedCategories.length === 0 && <div className="fl-empty">등록된 분류가 없습니다.</div>}
            </div>
          </div>
        </section>
      )}

      <section className="fl-card">
        <div className="fl-card-head vd-list-head">
          <span className="fl-card-title">업체 목록</span>
          <span className="fl-card-count">전체 {pageData?.totalElements ?? 0}개</span>
          <form className="vd-search" onSubmit={search}>
            <select
              className="fl-input"
              aria-label="업체 분류 필터"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">전체 분류</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>{category.name}</option>
              ))}
            </select>
            <input
              className="fl-input"
              aria-label="업체 검색어"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="업체·담당자·전화·이메일 검색"
            />
            <button className="fl-btn" type="submit" disabled={loading}>검색</button>
          </form>
        </div>

        <div className="fl-card-body fl-flush">
          <div className="vd-table-head">
            <span>업체명</span>
            <span>분류</span>
            <span>대표 연락처</span>
            <span>담당자</span>
            <span />
          </div>
          {loading && <div className="fl-empty">업체 목록을 불러오는 중...</div>}
          {!loading && items.length === 0 && (
            <div className="fl-empty">{query || categoryId ? '검색 결과가 없습니다.' : '등록된 업체가 없습니다.'}</div>
          )}
          {!loading && items.map((item) => <VendorRow key={item.id} item={item} onOpen={() => void openDetails(item)} onEdit={() => void openEdit(item.id)} />)}
        </div>
        <Pager page={page} totalPages={pageData?.totalPages ?? 0} onChange={goToPage} disabled={loading} />
      </section>

      {detailsLoading && (
        <div className="fl-modal-overlay" role="presentation">
          <div className="fl-modal" role="status">업체 정보를 불러오는 중...</div>
        </div>
      )}

      {details && !formOpen && (
        <div className="fl-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && setDetails(null)}>
          <section className="fl-modal vd-detail-modal" role="dialog" aria-modal="true" aria-labelledby="vd-detail-title">
            <div className="fl-modal-head">
              <div className="fl-modal-heading">
                <span className="fl-modal-title" id="vd-detail-title">{details.name}</span>
                <span className="fl-modal-sub">{details.categoryName}</span>
              </div>
              <button className="fl-modal-close" onClick={() => setDetails(null)} aria-label="닫기">✕</button>
            </div>
            <div className="fl-modal-body">
              <div className="vd-detail-grid">
                <DetailField label="대표 전화" value={details.mainPhone} phone />
                <DetailField label="대표 이메일" value={details.mainEmail} email />
                <DetailField label="사업자등록번호" value={details.businessRegistrationNo} />
                <DetailField label="주소" value={details.address} />
                <DetailField label="웹사이트" value={details.website} website />
              </div>
              {details.memo && <div className="vd-detail-note"><strong>메모</strong><p>{details.memo}</p></div>}
              <div className="vd-contact-heading">
                <strong>담당자</strong><span>{details.contacts.length}명</span>
              </div>
              {details.contacts.length === 0 ? (
                <div className="fl-empty vd-inline-empty">등록된 담당자가 없습니다.</div>
              ) : (
                <div className="vd-contact-list">
                  {details.contacts.map((contact) => (
                    <article className="vd-contact-card" key={contact.id}>
                      <div className="vd-contact-name">
                        <strong>{contact.name}</strong>
                        {contact.primary && <span className="fl-badge fl-tone-primary">대표 담당자</span>}
                        {(contact.department || contact.position) && (
                          <span className="vd-muted">{[contact.department, contact.position].filter(Boolean).join(' · ')}</span>
                        )}
                      </div>
                      <div className="vd-contact-links">
                        {contact.mobile && <a href={phoneHref(contact.mobile)}>휴대전화 {contact.mobile}</a>}
                        {contact.phone && <a href={phoneHref(contact.phone)}>전화 {contact.phone}</a>}
                        {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                      </div>
                      {contact.memo && <p className="vd-contact-memo">{contact.memo}</p>}
                    </article>
                  ))}
                </div>
              )}
              <div className="vd-audit-note">등록 {details.createdBy} · 수정 {details.updatedBy}</div>
            </div>
            <div className="fl-modal-foot">
              <div className="fl-modal-foot-actions">
                <button className="fl-btn" onClick={() => setDetails(null)}>닫기</button>
                <button className="fl-btn fl-btn-primary" onClick={() => void openEdit(details.id)}>수정</button>
              </div>
            </div>
          </section>
        </div>
      )}

      {formOpen && (
        <div className="fl-modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && closeForm()}>
          <form className="fl-modal vd-form-modal" onSubmit={saveVendor} role="dialog" aria-modal="true" aria-labelledby="vd-form-title">
            <div className="fl-modal-head">
              <div className="fl-modal-heading">
                <span className="fl-modal-title" id="vd-form-title">{editingId === null ? '업체 등록' : '업체 정보 수정'}</span>
                <span className="fl-modal-sub">사업자등록번호와 주소는 입력하지 않아도 됩니다.</span>
              </div>
              <button type="button" className="fl-modal-close" onClick={closeForm} aria-label="닫기">✕</button>
            </div>
            <div className="fl-modal-body vd-form-body">
              <div className="vd-form-grid">
                <label className="fl-field">
                  <span className="fl-field-label">업체명</span>
                  <input className="fl-input" value={draft.name} onChange={(event) => updateDraft('name', event.target.value)} maxLength={200} required autoFocus />
                </label>
                <label className="fl-field">
                  <span className="fl-field-label">분류</span>
                  <select className="fl-input" value={draft.categoryId || ''} onChange={(event) => updateDraft('categoryId', Number(event.target.value))} required>
                    <option value="" disabled>분류 선택</option>
                    {formCategories.map((category) => (
                      <option value={category.id} key={category.id}>
                        {category.name}{!category.active ? ' (사용 중지)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fl-field">
                  <span className="fl-field-label">사업자등록번호 <span className="fl-optional">(선택)</span></span>
                  <input className="fl-input" value={draft.businessRegistrationNo} onChange={(event) => updateDraft('businessRegistrationNo', event.target.value)} maxLength={32} />
                </label>
                <label className="fl-field">
                  <span className="fl-field-label">대표 전화 <span className="fl-optional">(선택)</span></span>
                  <input className="fl-input" type="tel" value={draft.mainPhone} onChange={(event) => updateDraft('mainPhone', event.target.value)} maxLength={50} />
                </label>
                <label className="fl-field">
                  <span className="fl-field-label">대표 이메일 <span className="fl-optional">(선택)</span></span>
                  <input className="fl-input" type="email" value={draft.mainEmail} onChange={(event) => updateDraft('mainEmail', event.target.value)} maxLength={254} />
                </label>
                <label className="fl-field">
                  <span className="fl-field-label">주소 <span className="fl-optional">(선택)</span></span>
                  <input className="fl-input" value={draft.address} onChange={(event) => updateDraft('address', event.target.value)} maxLength={500} />
                </label>
                <label className="fl-field vd-form-wide">
                  <span className="fl-field-label">웹사이트 <span className="fl-optional">(선택)</span></span>
                  <input className="fl-input" type="url" value={draft.website} onChange={(event) => updateDraft('website', event.target.value)} maxLength={500} placeholder="https://" />
                </label>
                <label className="fl-field vd-form-wide">
                  <span className="fl-field-label">메모 <span className="fl-optional">(선택)</span></span>
                  <textarea className="fl-input fl-textarea" value={draft.memo} onChange={(event) => updateDraft('memo', event.target.value)} maxLength={5000} />
                </label>
              </div>

              <div className="vd-contact-form-heading">
                <div><strong>담당자</strong><span className="fl-optional"> (선택, 여러 명 등록 가능)</span></div>
                <button type="button" className="fl-btn fl-btn-sm" onClick={addContact}>담당자 추가</button>
              </div>
              {draft.contacts.map((contact, index) => (
                <fieldset className="vd-contact-form" key={contact.id ?? `new-${index}`}>
                  <legend>담당자 {index + 1}</legend>
                  <label className="vd-primary-toggle">
                    <input
                      type="radio"
                      name="primary-contact"
                      checked={contact.primary}
                      onChange={() => setDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) => ({ ...item, primary: itemIndex === index })),
                      }))}
                    />
                    대표 담당자
                  </label>
                  <button type="button" className="fl-btn fl-btn-sm fl-btn-danger vd-remove-contact" onClick={() => removeContact(index)}>담당자 제거</button>
                  <div className="vd-form-grid">
                    <label className="fl-field">
                      <span className="fl-field-label">이름</span>
                      <input className="fl-input" value={contact.name} onChange={(event) => updateContact(index, { name: event.target.value })} maxLength={120} required />
                    </label>
                    <label className="fl-field">
                      <span className="fl-field-label">부서</span>
                      <input className="fl-input" value={contact.department} onChange={(event) => updateContact(index, { department: event.target.value })} maxLength={120} />
                    </label>
                    <label className="fl-field">
                      <span className="fl-field-label">직책</span>
                      <input className="fl-input" value={contact.position} onChange={(event) => updateContact(index, { position: event.target.value })} maxLength={120} />
                    </label>
                    <label className="fl-field">
                      <span className="fl-field-label">전화</span>
                      <input className="fl-input" type="tel" value={contact.phone} onChange={(event) => updateContact(index, { phone: event.target.value })} maxLength={50} />
                    </label>
                    <label className="fl-field">
                      <span className="fl-field-label">휴대전화</span>
                      <input className="fl-input" type="tel" value={contact.mobile} onChange={(event) => updateContact(index, { mobile: event.target.value })} maxLength={50} />
                    </label>
                    <label className="fl-field">
                      <span className="fl-field-label">이메일</span>
                      <input className="fl-input" type="email" value={contact.email} onChange={(event) => updateContact(index, { email: event.target.value })} maxLength={254} />
                    </label>
                    <label className="fl-field vd-form-wide">
                      <span className="fl-field-label">메모</span>
                      <input className="fl-input" value={contact.memo} onChange={(event) => updateContact(index, { memo: event.target.value })} maxLength={5000} />
                    </label>
                  </div>
                </fieldset>
              ))}
              {formError && <div className="fl-error" role="alert">{formError}</div>}
            </div>
            <div className="fl-modal-foot">
              <span className="fl-modal-foot-note">업체명과 분류는 필수입니다.</span>
              <div className="fl-modal-foot-actions">
                <button type="button" className="fl-btn" onClick={closeForm} disabled={saving}>취소</button>
                <button type="submit" className="fl-btn fl-btn-primary" disabled={saving || formCategories.length === 0}>
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function VendorRow({ item, onOpen, onEdit }: { item: VendorSummary; onOpen: () => void; onEdit: () => void }) {
  return (
    <article className="vd-table-row">
      <div className="vd-company-cell">
        <button className="vd-company-name" onClick={onOpen}>{item.name}</button>
        {item.primaryContactName && <span className="vd-mobile-sub">담당자 {item.primaryContactName}</span>}
      </div>
      <span className="vd-category-cell"><span className="fl-badge fl-tone-primary">{item.categoryName}</span></span>
      <div className="vd-contact-cell">
        {item.mainPhone && <a href={phoneHref(item.mainPhone)}>{item.mainPhone}</a>}
        {item.mainEmail && <a href={`mailto:${item.mainEmail}`}>{item.mainEmail}</a>}
        {!item.mainPhone && !item.mainEmail && <span className="vd-muted">대표 연락처 없음</span>}
      </div>
      <div className="vd-contact-cell">
        {item.primaryContactName ? <span>{item.primaryContactName}</span> : <span className="vd-muted">미등록</span>}
        {item.primaryContactPhone && <a href={phoneHref(item.primaryContactPhone)}>{item.primaryContactPhone}</a>}
      </div>
      <div className="vd-row-actions">
        <button className="fl-btn fl-btn-sm" onClick={onOpen}>상세</button>
        <button className="fl-btn fl-btn-sm" onClick={onEdit}>수정</button>
      </div>
    </article>
  )
}

function DetailField({
  label,
  value,
  phone = false,
  email = false,
  website = false,
}: {
  label: string
  value: string | null
  phone?: boolean
  email?: boolean
  website?: boolean
}) {
  if (!value) return null
  const href = phone ? phoneHref(value) : email ? `mailto:${value}` : website ? (value.startsWith('http') ? value : `https://${value}`) : null
  return (
    <div className="vd-detail-field">
      <dt>{label}</dt>
      <dd>{href ? <a href={href} target={website ? '_blank' : undefined} rel={website ? 'noreferrer' : undefined}>{value}</a> : value}</dd>
    </div>
  )
}
