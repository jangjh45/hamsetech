import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addComment, getNotice, listComments, deleteNotice } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'

export default function NoticeDetailPage() {
  const { id } = useParams()
  const noticeId = Number(id)
  const navigate = useNavigate()
  const [notice, setNotice] = useState<any>(null)
  const [comments, setComments] = useState<any[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

  useEffect(() => {
    if (!noticeId) return
    getNotice(noticeId).then(setNotice)
    listComments(noticeId).then(setComments)
  }, [noticeId])

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await addComment(noticeId, { content: text })
      setText('')
      const cs = await listComments(noticeId)
      setComments(cs)
    } catch (err: any) {
      setError(err.message || 'failed')
    }
  }

  async function onDelete() {
    if (!noticeId) return
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return
    try {
      await deleteNotice(noticeId)
      navigate('/notices')
    } catch (err: any) {
      alert(err.message || '삭제 실패')
    }
  }

  return (
    <div className="container" style={{ 
      padding: isMobile ? '16px' : '24px',
      display: 'flex',
      justifyContent: 'center'
    }}>
      <div className="panel" style={{ 
        maxWidth: 820, 
        width: '100%', 
        margin: '0 auto', 
        textAlign: isMobile ? 'center' : 'left',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          marginBottom: 16,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 12 : 0
        }}>
          <Link 
            className="btn ghost" 
            to="/notices"
            style={{ 
              width: isMobile ? '100%' : 'auto',
              fontSize: isMobile ? 14 : 16,
              padding: isMobile ? '12px 20px' : '12px 20px',
              textAlign: 'center'
            }}
          >
            ← 목록으로
          </Link>
          {(notice && (isAdmin() || getUsername() === notice.authorUsername)) && (
            <div style={{ 
              display: 'flex', 
              gap: isMobile ? 8 : 8,
              flexDirection: isMobile ? 'row' : 'row',
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'space-between' : 'flex-end'
            }}>
              <Link 
                className="btn ghost" 
                to={`/notice/${noticeId}/edit`}
                style={{ 
                  width: isMobile ? '48%' : 'auto',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 16px' : '12px 20px',
                  textAlign: 'center',
                  flex: isMobile ? 1 : 'none'
                }}
              >
                수정
              </Link>
              <button 
                className="btn ghost" 
                onClick={onDelete}
                style={{ 
                  width: isMobile ? '48%' : 'auto',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 16px' : '12px 20px',
                  textAlign: 'center',
                  flex: isMobile ? 1 : 'none'
                }}
              >
                삭제
              </button>
            </div>
          )}
        </div>
        {notice && (
          <>
            <h1 className="title" style={{ 
              marginBottom: 8,
              textAlign: isMobile ? 'center' : 'left',
              fontSize: isMobile ? '24px' : '32px',
              lineHeight: 1.3
            }}>
              {notice.title}
            </h1>
            <div className="meta" style={{ 
              marginBottom: 16,
              textAlign: isMobile ? 'center' : 'left',
              fontSize: isMobile ? '13px' : '14px',
              lineHeight: 1.5,
              color: 'var(--muted)'
            }}>
              <span>작성자: {notice.authorDisplayName || notice.authorUsername}</span>
              <span style={{ margin: '0 8px' }}>·</span>
              <time>{formatDateTime(notice.createdAt)}</time>
              {notice.updatedAt && notice.updatedAt !== notice.createdAt && (
                <>
                  <span style={{ margin: '0 8px' }}>·</span>
                  <span>수정됨: {formatDateTime(notice.updatedAt)}</span>
                </>
              )}
            </div>
            <div className="card" style={{ 
              padding: isMobile ? 16 : 20, 
              margin: '0 0 24px 0', 
              whiteSpace: 'pre-wrap', 
              lineHeight: 1.7,
              fontSize: isMobile ? '15px' : '16px',
              minHeight: '100px'
            }}>
              {notice.content}
            </div>
          </>
        )}
        <h3 style={{ 
          marginTop: 0, 
          marginBottom: 16,
          textAlign: isMobile ? 'center' : 'left',
          fontSize: isMobile ? '20px' : '24px',
          fontWeight: 600
        }}>
          댓글 ({comments.length})
        </h3>
        <div className="grid" style={{ gap: isMobile ? 12 : 16 }}>
          {comments.length === 0 ? (
            <div style={{ 
              padding: isMobile ? 20 : 24,
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: isMobile ? '14px' : '16px'
            }}>
              아직 댓글이 없습니다.
            </div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="card" style={{ 
                padding: isMobile ? 12 : 16,
                border: '1px solid var(--border)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: isMobile ? 8 : 8
                }}>
                  <div style={{ 
                    whiteSpace: 'pre-wrap', 
                    lineHeight: 1.6,
                    fontSize: isMobile ? '14px' : '15px',
                    marginBottom: isMobile ? 8 : 0
                  }}>
                    {c.content}
                  </div>
                  <div style={{ 
                    display: 'flex',
                    justifyContent: isMobile ? 'center' : 'flex-end',
                    alignItems: 'center',
                    gap: 8
                  }}>
                    <span style={{ 
                      fontSize: isMobile ? '12px' : '13px',
                      color: 'var(--muted)'
                    }}>
                      by {c.authorUsername}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        {isAuthenticated() && (
          <form className="form" onSubmit={onSubmit} style={{ 
            marginTop: 24,
            width: '100%',
            maxWidth: '100%',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              marginBottom: 12,
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <label style={{ 
                display: 'block',
                marginBottom: 8,
                fontSize: isMobile ? '14px' : '16px',
                fontWeight: 500,
                textAlign: isMobile ? 'center' : 'left'
              }}>
                댓글 작성
              </label>
              <textarea
                className="input"
                placeholder="댓글을 입력하세요..."
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={isMobile ? 4 : 5}
                style={{ 
                  resize: 'vertical',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 16px' : '16px 20px',
                  width: '100%',
                  maxWidth: '100%',
                  minHeight: isMobile ? '100px' : '120px',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxSizing: 'border-box',
                  overflow: 'hidden'
                }}
              />
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: isMobile ? 'center' : 'flex-end',
              marginTop: 16,
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box'
            }}>
              <button 
                className="btn" 
                type="submit"
                style={{ 
                  width: isMobile ? '100%' : 'auto',
                  fontSize: isMobile ? 14 : 16,
                  padding: isMobile ? '12px 24px' : '12px 32px',
                  minWidth: isMobile ? 'auto' : 120,
                  maxWidth: isMobile ? '100%' : 'none',
                  boxSizing: 'border-box'
                }}
              >
                댓글 등록
              </button>
            </div>
            {error && (
              <p className="error" style={{ 
                fontSize: isMobile ? 12 : 14,
                textAlign: isMobile ? 'center' : 'left',
                marginTop: 12,
                padding: '8px 12px',
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger)',
                borderRadius: '6px',
                width: '100%',
                maxWidth: '100%',
                boxSizing: 'border-box',
                overflow: 'hidden',
                wordWrap: 'break-word'
              }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

function formatDateTime(iso: string) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}


