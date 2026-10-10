import { useState } from 'react'

/**
 * 임시 비밀번호를 한 번만 보여 주는 창.
 *
 * 서버가 임시 비밀번호를 발급하면서 기존 로그인을 모두 끊고 로그인 잠금을 해제한다.
 * 이 값은 다시 볼 수 없으므로 관리자가 본인에게 전달해야 하고, 닫으면 사라진다.
 */
export default function TempPasswordModal({
  username,
  password,
  onClose,
}: {
  username: string
  password: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)

  function fallbackCopy() {
    const textarea = document.createElement('textarea')
    textarea.value = password
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '0'
    textarea.style.left = '-9999px'
    document.body.appendChild(textarea)

    const previouslyFocused = document.activeElement
    try {
      textarea.focus()
      textarea.select()
      textarea.setSelectionRange(0, textarea.value.length)
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      textarea.remove()
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }

  async function copy() {
    let success = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(password)
        success = true
      }
    } catch {
      // 비보안 연결·권한 거부 등 Clipboard API가 실패하면 레거시 복사를 시도한다.
    }

    if (!success) success = fallbackCopy()
    setCopied(success)
    setCopyFailed(!success)
    if (success) setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fl-modal-overlay">
      <div className="fl-modal ad-temp-modal" role="dialog" aria-modal="true">
        <div className="fl-modal-head">
          <div className="fl-modal-heading">
            <span className="fl-modal-title">임시 비밀번호 발급</span>
            <span className="fl-modal-sub">{username} 계정의 비밀번호가 초기화되었습니다.</span>
          </div>
        </div>

        <div className="fl-modal-body">
          <div className="ad-temp-value">
            <code>{password}</code>
            <button type="button" className="fl-btn fl-btn-sm" onClick={copy}>
              {copied ? '복사됨' : '복사'}
            </button>
          </div>
          {copyFailed && (
            <div className="fl-hint" role="status">
              자동 복사에 실패했습니다. 비밀번호를 직접 선택해 복사해 주세요.
            </div>
          )}

          <div className="fl-hint ad-temp-warn">
            이 값은 지금만 볼 수 있습니다. 창을 닫으면 다시 확인할 수 없고, 필요하면 다시
            초기화해야 합니다. 본인에게 전달한 뒤 로그인해서 새 비밀번호로 바꾸도록 안내하세요.
          </div>
        </div>

        <div className="fl-modal-foot">
          <span className="fl-modal-foot-note">기존 로그인과 로그인 잠금이 해제되었습니다.</span>
          <div className="fl-modal-foot-actions">
            <button type="button" className="fl-btn fl-btn-primary" onClick={onClose}>
              옮겨 적었습니다
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
