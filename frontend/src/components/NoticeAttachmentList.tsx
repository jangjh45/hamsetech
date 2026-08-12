import { useState } from 'react'
import {
  downloadAttachment,
  formatFileSize,
  type NoticeAttachment,
} from '../api/noticeAttachments'
import { PaperclipIcon } from './NoticeIcons'

interface Props {
  attachments: NoticeAttachment[]
  /** 편집 화면에서만 넘긴다. 있으면 제거 버튼이 붙는다. */
  onRemove?: (id: number) => void
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
          <PaperclipIcon className="nt-attach-icon" />
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
