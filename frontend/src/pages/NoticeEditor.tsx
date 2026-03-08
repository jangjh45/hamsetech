import { useEffect, useState } from 'react'
import { createNotice, getNotice, updateNotice } from '../api/notices'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { isAuthenticated } from '../auth/token'
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

  return (
    <div className="notice-container">
      <div className="notice-panel">
        <div className="notice-header">
          <h1 className="notice-title">공지 {editId ? '수정' : '등록'}</h1>
        </div>

        <form className="editor-form" onSubmit={onSubmit}>
          <div className="editor-field">
            <label>
              제목
              <span className="editor-char-count">{title.length}/200</span>
            </label>
            <input
              className="editor-input"
              placeholder="제목을 입력하세요"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="editor-field">
            <label>내용</label>
            <textarea
              className="editor-input"
              rows={15}
              placeholder="내용을 입력하세요"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ resize: 'vertical', minHeight: 200 }}
            />
          </div>

          {error && <p className="error">{error}</p>}

          <div className="editor-actions">
            <button
              className="btn btn-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting ? '저장 중...' : '💾 저장'}
            </button>
            <Link
              className="btn ghost"
              to={editId ? `/notice/${editId}` : '/notices'}
              style={{ padding: '12px 24px', textDecoration: 'none' }}
            >
              취소
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
