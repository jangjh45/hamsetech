import { useState } from 'react'
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
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 520, width: '100%', margin: '16px auto 32px' }}>
        <h1 className="title" style={{ textAlign: 'left' }}>회원가입</h1>
        <p className="subtitle" style={{ textAlign: 'left' }}>새 계정을 만듭니다</p>
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <input className="input" placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <input className="input" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <input className="input" type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="field">
            <input className="input" placeholder="이름 또는 닉네임" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <button className="btn" type="submit">가입하기</button>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}


