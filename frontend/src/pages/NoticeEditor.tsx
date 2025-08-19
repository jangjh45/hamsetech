import { useEffect, useState } from 'react'
import { createNotice, getNotice, updateNotice } from '../api/notices'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { isAdmin } from '../auth/token'

export default function NoticeEditorPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (editId) {
      getNotice(editId).then((n: any) => { setTitle(n.title); setContent(n.content) })
    }
  }, [editId])

  // access handled on server; editor visible to admins and owners via route/protectors

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      if (editId) {
        await updateNotice(editId, { title, content })
        navigate(`/notice/${editId}`)
      } else {
        const res: any = await createNotice({ title, content })
        navigate(`/notice/${res.id}`)
      }
    } catch (err: any) {
      setError(err.message || 'failed')
    }
  }

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 820, width: '100%', margin: '0 auto' }}>
        <h1 className="title">공지 {editId ? '수정' : '등록'}</h1>
        {editId && !isAdmin() && (
          <p className="subtitle">작성자만 수정/삭제할 수 있습니다.</p>
        )}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label">제목</label>
            <input className="input" placeholder="제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">내용</label>
            <textarea className="input" rows={12} placeholder="내용을 입력하세요" value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" type="submit">저장</button>
            <Link className="btn ghost" to={editId ? `/notice/${editId}` : '/notices'}>취소</Link>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}


