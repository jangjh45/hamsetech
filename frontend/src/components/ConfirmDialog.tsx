import { useEffect, useRef, useState } from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface ConfirmDialogProps {
  options: ConfirmOptions
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ options, onConfirm, onCancel }: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    confirmRef.current?.focus()
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="fl-modal-overlay" onClick={onCancel}>
      <div
        className="fl-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={options.title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fl-modal-body">
          <div className="fl-modal-title">{options.title}</div>
          {options.message && <div className="fl-modal-message">{options.message}</div>}
        </div>
        <div className="fl-modal-foot">
          <div className="fl-modal-foot-actions">
            <button className="fl-btn" onClick={onCancel}>
              {options.cancelText ?? '취소'}
            </button>
            <button
              ref={confirmRef}
              className={options.danger ? 'fl-btn fl-btn-danger' : 'fl-btn fl-btn-primary'}
              onClick={onConfirm}
            >
              {options.confirmText ?? '확인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Promise 기반 확인 다이얼로그 훅 */
export function useConfirm() {
  const [state, setState] = useState<{
    options: ConfirmOptions
    resolve: (value: boolean) => void
  } | null>(null)

  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      setState({ options, resolve })
    })
  }

  function close(result: boolean) {
    state?.resolve(result)
    setState(null)
  }

  const dialog = state ? (
    <ConfirmDialog
      options={state.options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null

  return { confirm, dialog }
}
