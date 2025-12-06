import { useEffect, useState } from 'react'
import { createNotice, getNotice, updateNotice } from '../api/notices'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { isAdmin } from '../auth/token'
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
    if (editId) {
      getNotice(editId).then((n: any) => { setTitle(n.title); setContent(n.content) })
    }
  }, [editId])

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
        const res: any = await createNotice({ title, content })
        navigate(`/notice/${res.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'failed')
      setSubmitting(false)
    }
  }

  return (
    <div className="notice-container">
      <div className="notice-panel">
        <div className="notice-header">
          <h1 className="notice-title">공지 {editId ? '수정' : '등록'}</h1>
          {editId && !isAdmin() && (
            <p className="subtitle" style={{ fontSize: 14 }}>작성자만 수정/삭제할 수 있습니다.</p>
          )}
        </div>

        <form className="editor-form" onSubmit={onSubmit}>
          <div className="editor-field">
            <label>제목</label>
            <input 
              className="editor-input" 
              placeholder="제목을 입력하세요" 
              value={title} 
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


