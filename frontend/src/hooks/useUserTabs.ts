import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from '../api/client'
import { getToken, getUsername, getRoles, saveAuth } from '../auth/token'

/**
 * 관리자 화면의 사용자 계열 세 탭(사용자 · 가입 승인 · 탈퇴 신청)이 들고 있는 것.
 *
 * 이 셋은 따로 독립시킬 수 없다. 승인·거절은 대기 목록과 사용자 목록을 동시에
 * 바꾸고, 탈퇴 확정은 사용자 목록과 탈퇴 신청 목록을 동시에 바꾼다. 로더를 탭마다
 * 따로 두면 한쪽만 갱신되어 화면이 어긋난다 — 그래서 셋을 하나로 묶었다.
 *
 * 변경 이력·조회 이력과 달리 여기서는 진입 시 목록을 미리 읽는다. 탭을 한 번도 열지
 * 않았는데도 배지에 대기 건수가 떠 있어야 한다.
 */
export function useUserTabs(opts: {
  /** 실패를 상위 배너로 보낸다. 화면 전체가 공유하므로 여기서 가지 않는다. */
  onError: (message: string) => void
  /** 자기 ADMIN을 잃었을 때. 상위가 화면을 닫고 홈으로 보낸다. */
  onSelfRevoked: () => void
}) {
  const [users, setUsers] = useState<any[]>([])
  const [query, setQuery] = useState('')
  const [pendingUsers, setPendingUsers] = useState<any[]>([])
  const [withdrawUsers, setWithdrawUsers] = useState<any[]>([])
  // 초기화 직후 한 번만 보여줄 임시 비밀번호. 창을 닫으면 다시 볼 수 없다.
  const [tempPassword, setTempPassword] = useState<{ username: string; password: string } | null>(
    null,
  )

  const loadUsers = useCallback(
    async (q = '') => {
      const search = q ? `?q=${encodeURIComponent(q)}` : ''
      const list = await apiFetch(`/api/admin/users${search}`)
      setUsers(list as any[])
    },
    [],
  )

  const loadPendingUsers = useCallback(async () => {
    const list = await apiFetch('/api/admin/users?status=PENDING')
    setPendingUsers(list as any[])
  }, [])

  const loadWithdrawUsers = useCallback(async () => {
    const list = await apiFetch('/api/admin/users?status=WITHDRAW_REQUESTED')
    setWithdrawUsers(list as any[])
  }, [])

  // 배지용 선로독. 실패는 배너로 알린다 — 예전엔 각 로더가 곧바로 setError를 불러서
  // "서버에 닿지 못했습니다"가 첫 진입 실패 곧바로 떴다. 조용히 넘기면 배지 숫자만
  // 비어 있고 사용자는 화면이 왜 비었는지 알 수 없다.
  // (hooks/useUserTabs.ts를 처음 만들 때 이 부분을 통째로 빼먹었고, 위의
  //  특성 테스트가 그걸 잡아냈다.)
  useEffect(() => {
    const report = (e: any) => opts.onError(e?.message || '목록을 불러오지 못했습니다')
    loadUsers('').catch(report)
    loadPendingUsers().catch(report)
    loadWithdrawUsers().catch(report)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadUsers, loadPendingUsers, loadWithdrawUsers])

  /** 승인·거절은 두 목록을 동시에 바꾼다. */
  async function decideUser(id: number, decision: 'approve' | 'reject') {
    try {
      await apiFetch(`/api/admin/users/${id}/${decision}`, { method: 'POST' })
      await Promise.all([loadPendingUsers(), loadUsers(query)])
    } catch (e: any) {
      opts.onError(e.message)
    }
  }

  /**
   * 탈퇴 확정은 되돌릴 수 없으므로 항상 사유를 묻고 한 번 더 확인한다.
   *
   * 잔업·특근 기록은 보존된다는 사실을 문구에 적었다. 관리자가 계정을 지우면 업무
   * 기록까지 간다고 오해해 승인하기를 멈추는 일이 있다.
   */
  async function withdrawUser(u: any) {
    const label = `${u.username}${u.displayName ? ` (${u.displayName})` : ''}`
    const reason = window.prompt(
      `${label} 계정을 탈퇴 처리합니다.\n` +
        '이메일·표시 이름이 삭제되고 다시 로그인할 수 없게 됩니다. 잔업·특근 기록은 보존됩니다.\n\n' +
        '처리 사유를 입력하세요.',
      u.withdrawReason || '',
    )
    if (reason === null) return
    try {
      await apiFetch(`/api/admin/users/${u.id}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      })
      await Promise.all([loadUsers(query), loadWithdrawUsers()])
    } catch (e: any) {
      opts.onError(e.message)
    }
  }

  async function rejectWithdraw(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/withdraw/reject`, { method: 'POST' })
      await Promise.all([loadUsers(query), loadWithdrawUsers()])
    } catch (e: any) {
      opts.onError(e.message)
    }
  }

  /**
   * 비밀번호 초기화.
   *
   * 자가 재설정을 없앤 자리를 대신한다. 서버가 만든 임시 비밀번호를 응답으로 한 번
   * 받아 관리자가 본인에게 직접 전달하는 방식이라, 받은 값을 놓치면 다시 초기화해야 한다.
   */
  async function resetPassword(u: any) {
    const label = `${u.username}${u.displayName ? ` (${u.displayName})` : ''}`
    if (
      !window.confirm(
        `${label} 계정의 비밀번호를 초기화합니다.\n\n` +
          '임시 비밀번호가 발급되고 이 계정의 기존 로그인은 모두 해제됩니다.\n' +
          '임시 비밀번호는 지금 한 번만 표시됩니다.',
      )
    ) {
      return
    }
    try {
      const res = await apiFetch(`/api/admin/users/${u.id}/reset-password`, { method: 'POST' })
      setTempPassword({ username: res.username, password: res.temporaryPassword })
    } catch (e: any) {
      opts.onError(e.message)
    }
  }

  async function grant(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/grant-admin`, { method: 'POST' })
      await loadUsers(query)
    } catch (e: any) {
      opts.onError(e.message)
    }
  }

  async function revoke(id: number) {
    try {
      await apiFetch(`/api/admin/users/${id}/revoke-admin`, { method: 'POST' })
      await loadUsers(query)

      // 자기 ADMIN을 빼앗겼다면 로컬 권한도 함께 내린다. 서버가 다음 요청을 403으로
      // 막겠지만, 권한이 화면에 남으면 사용자는 이유를 알 수 없다.
      const me = getUsername()
      const target = users.find((u) => u.id === id)
      if (target && me && target.username === me) {
        const token = getToken()
        const roles = getRoles().filter((r) => r !== 'ADMIN')
        if (token) saveAuth(token, roles, me)
        opts.onSelfRevoked()
      }
    } catch (e: any) {
      opts.onError(e.message)
    }
  }

  return {
    users,
    query,
    setQuery,
    pendingUsers,
    withdrawUsers,
    tempPassword,
    setTempPassword,
    loadUsers,
    loadPendingUsers,
    loadWithdrawUsers,
    decideUser,
    withdrawUser,
    rejectWithdraw,
    resetPassword,
    grant,
    revoke,
  }
}