import { useState } from 'react'
import {
  downloadAttachment,
  formatFileSize,
  type NoticeAttachment,
} from '../api/noticeAttachments'

interface Props {
  attachments: NoticeAttachment[]
  /** 편집 화면에서만 넘긴다. 있으면 제거 버튼이 붙는다. */
  onRemove?: (id: number) => void
}

/**
 * 클립 아이콘.
 *
 * 이모지(📎) 대신 선으로 그린다. 이모지는 OS마다 모양과 색이 제각각이라
 * 다크 모드에서 혼자 튀고, 이 화면의 다른 글리프(✎ ✕ ✓)와도 결이 다르다.
 * currentColor를 쓰므로 주변 글자색을 그대로 따라간다.
 */
function PaperclipIcon() {
  return (
    <svg
      className="nt-attach-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  )
}

/**
 * 첨부 목록.
 *
 * 본문에 삽입된 이미지(IMAGE)는 이미 본문에 보이므로 여기서는 빼고,
 * 내려받아야 하는 파일(FILE)만 보여 준다.
 */
export default function NoticeAttachmentList({ attachments, onRemove }: Props) {
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState('')

  const files = attachments.filter((a) => a.kind === 'FILE')
  if (files.length === 0) return null

  async function onDownload(att: NoticeAttachment) {
    setError('')
    setBusyId(att.id)
    try {
      await downloadAttachment(att)
    } catch (e) {
      setError(e instanceof Error ? e.message : '내려받기에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="nt-attachments">
      <div className="nt-attachments-title">
        첨부파일 <span className="nt-comments-count">{files.length}</span>
      </div>

      {files.map((att) => (
        <div key={att.id} className="nt-attach-row">
          <PaperclipIcon />
          <button
            type="button"
            className="nt-attach-name"
            onClick={() => onDownload(att)}
            disabled={busyId === att.id}
          >
            {att.originalFilename}
          </button>
          <span className="nt-attach-size">{formatFileSize(att.size)}</span>
          {onRemove && (
            <button
              type="button"
              className="nt-textlink nt-danger"
              onClick={() => onRemove(att.id)}
            >
              제거
            </button>
          )}
        </div>
      ))}

      {error && <p className="fl-error">{error}</p>}
    </div>
  )
}
