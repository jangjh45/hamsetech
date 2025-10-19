import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { saveAuth, saveDisplayName } from '../auth/token'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState<boolean>(window.innerWidth < 768)

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
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, displayName }),
      })
      const { token, roles, username: uname, displayName: dname } = data as any
      saveAuth(token, roles ?? [], uname)
      if (dname) saveDisplayName(dname)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'register failed')
    }
  }

  return (
    <div className="container" style={{ 
      display: 'flex', 
      justifyContent: 'center',
      padding: isMobile ? '16px' : '24px'
    }}>
      <div className="panel" style={{ 
        maxWidth: 520, 
        width: '100%', 
        margin: '16px auto 32px',
        textAlign: isMobile ? 'center' : 'left'
      }}>
        <h1 className="title" style={{ textAlign: isMobile ? 'center' : 'left' }}>회원가입</h1>
        <p className="subtitle" style={{ textAlign: isMobile ? 'center' : 'left' }}>새 계정을 만듭니다</p>
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <input 
              className="input" 
              placeholder="아이디" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
            />
          </div>
          <div className="field">
            <input 
              className="input" 
              placeholder="이메일" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div className="field">
            <input 
              className="input" 
              type="password" 
              placeholder="비밀번호" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          <div className="field">
            <input 
              className="input" 
              placeholder="이름 또는 닉네임" 
              value={displayName} 
              onChange={(e) => setDisplayName(e.target.value)} 
            />
          </div>
          <button 
            className="btn" 
            type="submit"
            style={{ width: isMobile ? '100%' : 'auto' }}
          >
            가입하기
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}


