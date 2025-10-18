import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../api/client'
import { getUsername as getMe, getToken, getRoles, saveAuth, onTokenExpired } from '../auth/token'

export default function AdminPage() {
  const [msg, setMsg] = useState('loading...')
  const [error, setError] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [tokenExpired, setTokenExpired] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const me = getMe()
    const roles = getRoles()
    if (roles.includes('SUPER_ADMIN')) {
      setMsg(`현재 로그인된 계정${me ? ` (${me})` : ''}은 슈퍼관리자입니다.`)
    } else if (roles.includes('ADMIN')) {
      setMsg(`현재 로그인된 계정${me ? ` (${me})` : ''}은 관리자입니다.`)
    } else {
      setMsg(`현재 로그인된 계정${me ? ` (${me})` : ''}은 관리자 권한이 없습니다.`)
    }
  }, [])

  // 토큰 만료 이벤트 리스너 설정
  useEffect(() => {
    const unsubscribe = onTokenExpired(() => {
      setTokenExpired(true)
      setError('세션이 만료되었습니다. 다시 로그인해주세요.')
    })
    
    return unsubscribe
  }, [])

  async function loadUsers(query = q) {
    try {
      const search = query ? `?q=${encodeURIComponent(query)}` : ''
      const list = await apiFetch(`/api/admin/users${search}`)
      setUsers(list as any[])
    } catch (e: any) {
      setError(e.message || 'load failed')
    }
  }

  useEffect(() => { loadUsers('') }, [])

  async function grant(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/grant-admin`, { method: 'POST' })
      await loadUsers()
    } catch (e: any) { setError(e.message) }
  }

  async function revoke(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/revoke-admin`, { method: 'POST' })
      await loadUsers()
      // If current user revoked self, drop ADMIN locally and leave admin page
      const me = getMe()
      const target = users.find(u => u.id === id)
      if (target && me && target.username === me) {
        const token = getToken()
        const roles = getRoles().filter(r => r !== 'ADMIN')
        if (token) {
          saveAuth(token, roles, me)
        }
        navigate('/')
      }
    } catch (e: any) { setError(e.message) }
  }

  return (
    <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: 900, width: '100%', margin: '16px auto 32px' }}>
        <div style={{ marginBottom: 12 }}>
          <h1 className="title" style={{ marginBottom: 6, textAlign: 'left' }}>관리자</h1>
          <p className="subtitle">ADMIN 권한이 있어야 접근할 수 있습니다</p>
        </div>
        {tokenExpired && (
          <div style={{ 
            padding: '12px 16px', 
            backgroundColor: '#fee2e2', 
            border: '1px solid #fca5a5', 
            borderRadius: '8px', 
            marginBottom: '16px',
            color: '#dc2626'
          }}>
            <strong>세션 만료 알림</strong><br />
            로그인 세션이 만료되었습니다. 잠시 후 로그인 페이지로 이동됩니다.
          </div>
        )}
        {error ? <p className="error">{error}</p> : <p className="subtitle" style={{ marginTop: 0 }}>{msg}</p>}

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, marginBottom: 12 }}>
          <input className="input" placeholder="사용자 검색" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
          <button className="btn ghost" onClick={() => loadUsers(q)}>검색</button>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '60px 270px 150px 240px 120px', alignItems: 'center', gap: 8, padding: '10px 12px', height: 50, borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontSize: 14 }}>
            <div style={{ textAlign: 'right', paddingRight: 8 }}>ID</div>
            <div>사용자명</div>
            <div>역할</div>
            <div style={{ textAlign: 'center' }}>이름/닉네임 관리</div>
            <div style={{ textAlign: 'center' }}>권한</div>
          </div>
          {users.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: 'var(--muted)' }}>사용자가 없습니다.</div>
          )}
          {users.map((u: any) => {
            const roles = u.roles || []
            const isAdmin = roles.includes('ADMIN')
            const isSuperAdmin = roles.includes('SUPER_ADMIN')
            return (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '60px 270px 150px 240px 120px', alignItems: 'center', gap: 8, padding: '10px 12px', height: 50, borderBottom: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ textAlign: 'right', paddingRight: 8 }}>{u.id}</div>
                <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{u.username}{u.displayName ? ` (${u.displayName})` : ''}</div>
                <div style={{ color: 'var(--muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={(roles || []).join(', ')}>{roles.join(', ')}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
                  {(() => {
                    let inputEl: HTMLInputElement | null = null;
                    return (
                      <>
                        <input ref={(el) => { inputEl = el }} className="input" placeholder="이름/닉네임" defaultValue={u.displayName || ''} style={{ width: 100 }} />
                        <button className="btn ghost" onClick={async () => { try { const val = (inputEl && inputEl.value) || ''; await apiFetch(`/api/admin/users/${u.id}/display-name`, { method: 'PUT', body: JSON.stringify({ displayName: val }) }); await loadUsers(); } catch (e:any) { setError(e.message) } }}>저장</button>
                      </>
                    )
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {!isSuperAdmin && (
                    isAdmin ? (
                      <button className="btn ghost" style={{ width: 120 }} onClick={() => revoke(u.id)}>ADMIN 해제</button>
                    ) : (
                      <button className="btn ghost" style={{ width: 120 }} onClick={() => grant(u.id)}>ADMIN 부여</button>
                    )
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


