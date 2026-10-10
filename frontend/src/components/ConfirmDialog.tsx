import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: 'primary' | 'warning' | 'danger'
}

export interface PromptOptions extends ConfirmOptions {
  inputLabel?: string
  inputPlaceholder?: string
  defaultValue?: string
  maxLength?: number
  required?: boolean
}

type DialogResult = boolean | string | null | undefined

type DialogRequest = {
  id: number
  resolve: (value: DialogResult) => void
} & (
  | { type: 'confirm'; options: ConfirmOptions }
  | { type: 'prompt'; options: PromptOptions }
  | { type: 'alert'; options: ConfirmOptions }
)

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  prompt: (options: PromptOptions) => Promise<string | null>
  alert: (options: ConfirmOptions) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

interface ConfirmProviderProps {
  children: ReactNode
}

export function ConfirmProvider({ children }: ConfirmProviderProps) {
  const [active, setActive] = useState<DialogRequest | null>(null)
  const activeRef = useRef<DialogRequest | null>(null)
  const queueRef = useRef<DialogRequest[]>([])
  const nextIdRef = useRef(0)

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null
    activeRef.current = next
    setActive(next)
  }, [])

  const enqueue = useCallback((request: DialogRequest) => {
    queueRef.current.push(request)
    if (activeRef.current === null) showNext()
  }, [showNext])

  const confirm = useCallback((options: ConfirmOptions) => new Promise<boolean>((resolve) => {
    enqueue({
      id: nextIdRef.current++,
      type: 'confirm',
      options,
      resolve: (value) => resolve(value === true),
    })
  }), [enqueue])

  const prompt = useCallback((options: PromptOptions) => new Promise<string | null>((resolve) => {
    enqueue({
      id: nextIdRef.current++,
      type: 'prompt',
      options,
      resolve: (value) => resolve(typeof value === 'string' ? value : null),
    })
  }), [enqueue])

  const alert = useCallback((options: ConfirmOptions) => new Promise<void>((resolve) => {
    enqueue({
      id: nextIdRef.current++,
      type: 'alert',
      options,
      resolve: () => resolve(),
    })
  }), [enqueue])

  const settle = useCallback((value: DialogResult) => {
    const current = activeRef.current
    if (!current) return
    activeRef.current = null
    current.resolve(value)
    showNext()
  }, [showNext])

  const contextValue = useMemo(() => ({ confirm, prompt, alert }), [confirm, prompt, alert])

  return (
    <ConfirmContext.Provider value={contextValue}>
      {children}
      {active && <ConfirmDialog key={active.id} request={active} onResolve={settle} />}
    </ConfirmContext.Provider>
  )
}

// Provider와 같은 모듈에 있어야 하므로 Fast Refresh export 검사에서 제외한다.
// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmContextValue {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return context
}

interface ConfirmDialogProps {
  request: DialogRequest
  onResolve: (value: DialogResult) => void
}

function ConfirmDialog({ request, onResolve }: ConfirmDialogProps) {
  const isPrompt = request.type === 'prompt'
  const isAlert = request.type === 'alert'
  const initialValue = request.type === 'prompt' ? request.options.defaultValue ?? '' : ''
  const [inputValue, setInputValue] = useState(initialValue)
  const [inputError, setInputError] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const cancel = useCallback(
    () => onResolve(isPrompt ? null : isAlert ? undefined : false),
    [isAlert, isPrompt, onResolve],
  )

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (isPrompt) inputRef.current?.focus()
    else confirmRef.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        cancel()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), textarea:not(:disabled)',
      )
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      previouslyFocused?.focus()
    }
  }, [cancel, isPrompt])

  function submit() {
    if (request.type === 'prompt') {
      if (request.options.required && !inputValue.trim()) {
        setInputError('내용을 입력해주세요.')
        inputRef.current?.focus()
        return
      }
      onResolve(inputValue)
      return
    }
    onResolve(true)
  }

  const titleId = `confirm-title-${request.id}`
  const messageId = request.options.message ? `confirm-message-${request.id}` : undefined
  const variant = request.options.variant ?? 'primary'
  const confirmClass = variant === 'danger'
    ? 'fl-btn fl-btn-danger-solid'
    : variant === 'warning'
      ? 'fl-btn fl-btn-warning'
      : 'fl-btn fl-btn-primary'

  return (
    <div className="fl-modal-overlay" onClick={cancel}>
      <div
        ref={dialogRef}
        className="fl-modal fl-confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="fl-modal-body">
          <div id={titleId} className="fl-modal-title">{request.options.title}</div>
          {request.options.message && (
            <div id={messageId} className="fl-modal-message">{request.options.message}</div>
          )}
          {request.type === 'prompt' && (
            <label className="fl-confirm-prompt-label">
              <span>{request.options.inputLabel ?? '내용'}</span>
              <textarea
                ref={inputRef}
                className="fl-input fl-textarea fl-confirm-prompt-input"
                value={inputValue}
                placeholder={request.options.inputPlaceholder}
                maxLength={request.options.maxLength}
                onChange={(event) => {
                  setInputValue(event.target.value)
                  setInputError('')
                }}
              />
            </label>
          )}
          {inputError && <p className="fl-error" role="alert">{inputError}</p>}
        </div>
        <div className="fl-modal-foot">
          <div className="fl-modal-foot-actions">
            {!isAlert && (
              <button className="fl-btn" onClick={cancel}>
                {request.options.cancelText ?? '취소'}
              </button>
            )}
            <button ref={confirmRef} className={confirmClass} onClick={submit}>
              {request.options.confirmText ?? '확인'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
