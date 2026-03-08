import { useState } from 'react'
import type { NoticeComment } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'
import { formatDateTime } from '../utils/formatDate'

export interface CommentNodeData extends NoticeComment {
  replies: CommentNodeData[]
}

interface Props {
  node: CommentNodeData
  noticeId: number
  depth?: number
  onReply: (noticeId: number, parentId: number, content: string) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
}

export default function CommentNode({ node, noticeId, depth = 0, onReply, onDelete }: Props) {
  const isReply = depth > 0
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleReplySubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!replyText.trim()) {
      setError('답글을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      await onReply(noticeId, node.id, replyText)
      setReplyText('')
      setReplyOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '등록 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="comment-node">
      <div className={`comment-card ${isReply ? 'reply' : ''}`}>
        <div className="comment-header">
          <span className="comment-author">
            {isReply && '↳ '}
            {node.authorUsername}
          </span>
          <span className="comment-date">{formatDateTime(node.createdAt)}</span>
        </div>

        <div className="comment-body">{node.content}</div>

        <div className="comment-footer">
          {isAuthenticated() && !isReply && (
            <button
              className="btn-text"
              onClick={() => { setReplyOpen(!replyOpen); setReplyText(''); setError('') }}
            >
              {replyOpen ? '취소' : '답글'}
            </button>
          )}
          {isAuthenticated() && (isAdmin() || getUsername() === node.authorUsername) && (
            <button className="btn-text danger" onClick={() => onDelete(node.id)}>
              삭제
            </button>
          )}
        </div>

        {replyOpen && (
          <form onSubmit={handleReplySubmit} className="reply-form">
            <textarea
              className="comment-input"
              placeholder="답글을 입력하세요..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
              rows={3}
            />
            {error && <p className="error" style={{ marginTop: 4, marginBottom: 0 }}>{error}</p>}
            <div className="reply-form-actions">
              <button
                type="button"
                className="btn ghost"
                onClick={() => { setReplyOpen(false); setReplyText('') }}
              >
                취소
              </button>
              <button
                type="submit"
                className="btn btn-submit"
                disabled={!replyText.trim() || submitting}
              >
                {submitting ? '...' : '등록'}
              </button>
            </div>
          </form>
        )}
      </div>

      {node.replies.length > 0 && (
        <div className="comment-replies">
          {node.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              node={reply}
              noticeId={noticeId}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
