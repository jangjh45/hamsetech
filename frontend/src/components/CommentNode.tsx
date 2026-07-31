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
    <div className="nt-comment-node">
      <div className={isReply ? 'nt-comment is-reply' : 'nt-comment'}>
        <div className="nt-comment-head">
          <span className="nt-comment-author">
            {isReply && '↳ '}
            {node.authorUsername}
          </span>
          <span className="nt-comment-date">{formatDateTime(node.createdAt)}</span>
        </div>

        <div className="nt-comment-body">{node.content}</div>

        <div className="nt-comment-foot">
          {isAuthenticated() && !isReply && (
            <button
              className="nt-textlink"
              onClick={() => { setReplyOpen(!replyOpen); setReplyText(''); setError('') }}
            >
              {replyOpen ? '취소' : '답글'}
            </button>
          )}
          {isAuthenticated() && (isAdmin() || getUsername() === node.authorUsername) && (
            <button className="nt-textlink nt-danger" onClick={() => onDelete(node.id)}>
              삭제
            </button>
          )}
        </div>

        {replyOpen && (
          <form onSubmit={handleReplySubmit} className="nt-comment-form">
            <textarea
              className="fl-input nt-textarea"
              placeholder="답글을 입력하세요..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value.slice(0, 500))}
              rows={3}
            />
            {error && <p className="fl-error">{error}</p>}
            <div className="nt-comment-form-foot">
              <span className="nt-charcount">{replyText.length}/500</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  type="button"
                  className="fl-btn fl-btn-sm"
                  onClick={() => { setReplyOpen(false); setReplyText('') }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="fl-btn fl-btn-primary fl-btn-sm"
                  disabled={!replyText.trim() || submitting}
                >
                  {submitting ? '...' : '등록'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>

      {node.replies.length > 0 && (
        <div className="nt-comment-replies">
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
