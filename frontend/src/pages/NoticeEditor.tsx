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
  const [submitting, setSubmitting] = useState(false)
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    if (editId) {
      getNotice(editId).then((n: any) => { setTitle(n.title); setContent(n.content) })
    }
  }, [editId])

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // access handled on server; editor visible to admins and owners via route/protectors

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
    <div className="container" style={{ display: 'flex', justifyContent: 'center', padding: isMobile ? '16px' : '24px' }}>
      <div className="panel" style={{ maxWidth: 820, width: '100%', margin: '0 auto', padding: isMobile ? '16px' : '20px' }}>
        <h1 className="title" style={{ fontSize: isMobile ? '24px' : '32px', textAlign: isMobile ? 'center' : 'left' }}>공지 {editId ? '수정' : '등록'}</h1>
        {editId && !isAdmin() && (
          <p className="subtitle" style={{ fontSize: isMobile ? '13px' : '14px', textAlign: isMobile ? 'center' : 'left' }}>작성자만 수정/삭제할 수 있습니다.</p>
        )}
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <label className="label" style={{ fontSize: isMobile ? '14px' : '16px' }}>제목</label>
            <input className="input" placeholder="제목을 입력하세요" value={title} onChange={(e) => setTitle(e.target.value)} style={{ fontSize: isMobile ? '14px' : '16px' }} />
          </div>
          <div className="field">
            <label className="label" style={{ fontSize: isMobile ? '14px' : '16px' }}>내용</label>
            <textarea className="input" rows={12} placeholder="내용을 입력하세요" value={content} onChange={(e) => setContent(e.target.value)} style={{ fontSize: isMobile ? '14px' : '16px' }} />
          </div>
          <div style={{ 
            display: 'flex', 
            gap: isMobile ? 8 : 12,
            flexDirection: isMobile ? 'column' : 'row',
            width: '100%'
          }}>
            <button 
              className="btn btn-submit" 
              type="submit"
              disabled={submitting}
              style={{ 
                flex: isMobile ? 1 : 'none',
                width: isMobile ? '100%' : 'auto',
                fontSize: isMobile ? '14px' : '16px',
                minWidth: isMobile ? 'auto' : 120
              }}
            >
              {submitting ? '💾 저장 중...' : '💾 저장'}
            </button>
            <Link 
              className="btn ghost" 
              to={editId ? `/notice/${editId}` : '/notices'}
              style={{ 
                flex: isMobile ? 1 : 'none',
                width: isMobile ? '100%' : 'auto',
                fontSize: isMobile ? '14px' : '16px',
                textAlign: 'center',
                padding: isMobile ? '12px 16px' : '12px 20px'
              }}
            >
              ✕ 취소
            </Link>
          </div>
          {error && <p className="error" style={{ 
            fontSize: isMobile ? '13px' : '14px',
            marginTop: 12,
            padding: '8px 12px',
            backgroundColor: 'var(--danger-bg)',
            border: '1px solid var(--danger)',
            borderRadius: '6px',
            animation: 'slideIn 0.3s ease-out'
          }}>{error}</p>}
        </form>
      </div>
    </div>
  )
}


