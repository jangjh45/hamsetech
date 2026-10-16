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
import { SERVER_ERROR_EVENT, type ServerErrorDetail } from '../api/serverErrorEvent'
import '../styles/toast.css'

export type NotifyTone = 'info' | 'success' | 'warning' | 'error'

export interface NotifyOptions {
  message: string
  /** 생략하면 톤에 맞는 기본 제목을 쓴다. */
  title?: string
  tone?: NotifyTone
  /** 같은 key의 알림이 떠 있으면 새로 쌓지 않고 갱신한다. 생략하면 메시지가 key다. */
  key?: string
  /** 자동으로 닫히기까지의 ms. 0이면 직접 닫을 때까지 남는다. */
  duration?: number
}

interface ToastEntry {
  id: number
  key: string
  title: string
  message: string
  tone: NotifyTone
  duration: number
  /** 퇴장 애니메이션 중인 항목. 애니메이션이 끝나면 목록에서 실제로 지운다. */
  leaving: boolean
}

interface NotifyContextValue {
  notify: (options: NotifyOptions) => void
  clear: () => void
}

const DEFAULT_DURATION: Record<NotifyTone, number> = {
  info: 4000,
  success: 4000,
  warning: 6000,
  error: 6000,
}

const DEFAULT_TITLE: Record<NotifyTone, string> = {
  info: '알림',
  success: '완료되었어요',
  warning: '확인이 필요해요',
  error: '문제가 생겼어요',
}

const MAX_TOASTS = 4

/** CSS의 퇴장 전환(접힘 포함)이 끝나는 시간보다 조금 길게 잡는다. */
const EXIT_DURATION = 380

const NotifyContext = createContext<NotifyContextValue | null>(null)

/** 떠 있는 알림이 한도를 넘으면 가장 오래된 것부터 퇴장시킨다. */
function retireOverflow(list: ToastEntry[]): ToastEntry[] {
  const live = list.filter((entry) => !entry.leaving)
  const overflow = live.length - MAX_TOASTS
  if (overflow <= 0) return list
  const retiring = new Set(live.slice(0, overflow).map((entry) => entry.id))
  return list.map((entry) => (retiring.has(entry.id) ? { ...entry, leaving: true } : entry))
}

export function NotifyProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([])
  const nextIdRef = useRef(0)

  const notify = useCallback((options: NotifyOptions) => {
    const tone = options.tone ?? 'info'
    const key = options.key ?? options.message
    const entry: ToastEntry = {
      id: nextIdRef.current++,
      key,
      title: options.title ?? DEFAULT_TITLE[tone],
      message: options.message,
      tone,
      duration: options.duration ?? DEFAULT_DURATION[tone],
      leaving: false,
    }
    setEntries((current) => retireOverflow([...current.filter((item) => item.key !== key), entry]))
  }, [])

  const dismiss = useCallback((id: number) => {
    setEntries((current) => current.map((item) => (item.id === id ? { ...item, leaving: true } : item)))
  }, [])

  const remove = useCallback((id: number) => {
    setEntries((current) => current.filter((item) => item.id !== id))
  }, [])

  const clear = useCallback(() => {
    setEntries((current) => current.map((item) => (item.leaving ? item : { ...item, leaving: true })))
  }, [])

  useEffect(() => {
    function onServerError(event: Event) {
      const detail = (event as CustomEvent<ServerErrorDetail>).detail
      if (detail.kind === 'network') {
        notify({
          key: 'network-error',
          tone: 'error',
          message: '서버에 연결하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.',
        })
        return
      }
      notify({
        key: 'server-error',
        tone: 'error',
        message: '서버에 일시적인 문제가 생겼습니다. 잠시 후 다시 시도해주세요.',
      })
    }
    window.addEventListener(SERVER_ERROR_EVENT, onServerError)
    return () => window.removeEventListener(SERVER_ERROR_EVENT, onServerError)
  }, [notify])

  const contextValue = useMemo(() => ({ notify, clear }), [notify, clear])

  return (
    <NotifyContext.Provider value={contextValue}>
      {children}
      <div className="fl-toast-stack" aria-live="polite">
        {entries.map((entry) => (
          <ToastItem key={entry.id} entry={entry} onDismiss={dismiss} onRemove={remove} />
        ))}
      </div>
    </NotifyContext.Provider>
  )
}

// Provider와 같은 모듈에 있어야 하므로 Fast Refresh export 검사에서 제외한다.
// eslint-disable-next-line react-refresh/only-export-components
export function useNotify(): NotifyContextValue {
  const context = useContext(NotifyContext)
  if (!context) {
    throw new Error('useNotify must be used within a NotifyProvider')
  }
  return context
}

interface ToastItemProps {
  entry: ToastEntry
  onDismiss: (id: number) => void
  onRemove: (id: number) => void
}

function ToastItem({ entry, onDismiss, onRemove }: ToastItemProps) {
  const { id, tone, title, message, duration, leaving } = entry
  const [paused, setPaused] = useState(false)
  const remainingRef = useRef(duration)
  const startedAtRef = useRef(0)

  // 마우스가 올라가 있거나 포커스가 들어와 있는 동안은 남은 시간을 멈춘다.
  // 읽는 도중에 사라지면 안 되고, 키보드 사용자는 닫기 버튼까지 갈 시간이 필요하다.
  useEffect(() => {
    if (paused || leaving || duration <= 0) return
    startedAtRef.current = Date.now()
    const timer = window.setTimeout(() => onDismiss(id), remainingRef.current)
    return () => {
      window.clearTimeout(timer)
      remainingRef.current -= Date.now() - startedAtRef.current
    }
  }, [paused, leaving, id, duration, onDismiss])

  useEffect(() => {
    if (!leaving) return
    const timer = window.setTimeout(() => onRemove(id), EXIT_DURATION)
    return () => window.clearTimeout(timer)
  }, [leaving, id, onRemove])

  const frozen = paused || leaving

  return (
    <div className={`fl-toast-slot${leaving ? ' is-leaving' : ''}`}>
      <div className="fl-toast-clip">
        <div
          className={`fl-toast is-${tone}${leaving ? ' is-leaving' : ''}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <span className="fl-toast-icon" aria-hidden="true">
            <ToneIcon tone={tone} />
          </span>
          <div className="fl-toast-body">
            <div className="fl-toast-title">{title}</div>
            <div className="fl-toast-message">{message}</div>
          </div>
          <button
            type="button"
            className="fl-toast-close"
            aria-label="알림 닫기"
            onClick={() => onDismiss(id)}
          >
            <CloseIcon />
          </button>
          {duration > 0 && (
            <span
              className="fl-toast-progress"
              style={{
                animationDuration: `${duration}ms`,
                animationPlayState: frozen ? 'paused' : 'running',
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ToneIcon({ tone }: { tone: NotifyTone }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {tone === 'success' && <path d="M5 12.5l4.2 4.2L19 7" />}
      {tone === 'info' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" />
          <path d="M12 7.6h.01" />
        </>
      )}
      {tone === 'warning' && (
        <>
          <path d="M12 4.5l8.5 14.5h-17z" />
          <path d="M12 10v4" />
          <path d="M12 17.2h.01" />
        </>
      )}
      {tone === 'error' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </>
      )}
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
