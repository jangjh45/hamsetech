import { useEffect, useState } from 'react'
import { createNotice, getNotice, updateNotice } from '../api/notices'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { isAuthenticated, getDisplayName } from '../auth/token'
import '../styles/notices.css'

export default function NoticeEditorPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true })
      return
    }
    if (editId) {
      getNotice(editId).then((n) => { setTitle(n.title); setContent(n.content) })
    }
  }, [editId, navigate])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    if (!content.trim()) {
      setError('내용을 입력해주세요.')
      return
    }
    try {
      setSubmitting(true)
      if (editId) {
        await updateNotice(editId, { title, content })
        navigate(`/notice/${editId}`)
      } else {
        const res = await createNotice({ title, content })
        navigate(`/notice/${res.id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장 실패')
      setSubmitting(false)
    }
  }

  const author = getDisplayName()

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>공지 {editId ? '수정' : '등록'}</h1>
          {author && <p>작성자 {author}</p>}
        </div>
      </div>

      <form className="fl-card" onSubmit={onSubmit}>
        <div className="fl-card-body" style={{ gap: 18 }}>
          <div className="nt-field">
            <span className="nt-field-label">
              제목
              <span className="nt-charcount">{title.length}/200</span>
            </span>
            <input
              className="fl-input nt-input-lg"
              placeholder="공지 제목을 입력하세요"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="nt-field">
            <span className="nt-field-label">내용</span>
            <textarea
              className="fl-input nt-textarea nt-textarea-lg"
              placeholder="공지 내용을 입력하세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>

          {error && <p className="fl-error">{error}</p>}
        </div>

        <div className="nt-actions">
          <Link className="fl-btn" to={editId ? `/notice/${editId}` : '/notices'}>
            취소
          </Link>
          <div className="nt-actions-right">
            <button className="fl-btn fl-btn-primary" type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : editId ? '수정' : '등록'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
