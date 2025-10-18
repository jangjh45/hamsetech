import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { saveAuth, saveDisplayName } from '../auth/token'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      const { token, roles, username: uname, displayName } = data as any
      const roleList: string[] = roles ?? []
      saveAuth(token, roleList, uname)
      if (displayName) saveDisplayName(displayName)
      if (roleList.includes('ADMIN')) {
        navigate('/admin')
      } else {
        navigate('/')
      }
    } catch (err: any) {
      // 로그인 실패 시 더 친화적인 오류 메시지 표시
      const errorMessage = err.message || '로그인에 실패했습니다.'
      if (errorMessage.includes('세션이 만료되었습니다')) {
        setError('로그인 세션이 만료되었습니다. 다시 로그인해주세요.')
      } else if (errorMessage.includes('아이디 또는 비밀번호가 올바르지 않습니다')) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      } else if (errorMessage.includes('Failed to execute')) {
        setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
      } else {
        setError(errorMessage)
      }
    }
  }

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 520, width: '100%', margin: '16px auto 32px' }}>
        <h1 className="title" style={{ textAlign: 'left' }}>로그인</h1>
        <p className="subtitle" style={{ textAlign: 'left' }}>계정으로 로그인하세요</p>
        <form className="form" onSubmit={onSubmit}>
          <div className="field">
            <input className="input" placeholder="아이디" value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <input className="input" type="password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn" type="submit">로그인</button>
          <div>
            <a className="link-plain" href="/forgot-password">비밀번호를 잊으셨나요?</a>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      </div>
    </div>
  )
}


