import { useState } from 'react'
import type { NoticeComment } from '../api/notices'
import { isAuthenticated, isAdmin, getUsername } from '../auth/token'
import { formatDateTime } from '../utils/formatDate'
import UserAvatar from './UserAvatar'

export interface CommentNodeData extends NoticeComment {
  replies: CommentNodeData[]
}

interface Props {
  node: CommentNodeData
  noticeId: number
  depth?: number
  onReply: (noticeId: number, parentId: number, content: string) => Promise<void>
  onEdit: (commentId: number, content: string) => Promise<void>
  onDelete: (commentId: number) => Promise<void>
}

export default function CommentNode({ node, noticeId, depth = 0, onReply, onEdit, onDelete }: Props) {
  const isReply = depth > 0
  const authorName = node.authorDisplayName?.trim() || node.authorUsername
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [editOpen, setEditOpen] = useState(false)
  const [editText, setEditText] = useState(node.content)
  const [submitting, setSubmitting] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
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

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editText.trim()) {
      setError('댓글을 입력해주세요.')
      return
    }
    setSavingEdit(true)
    setError('')
    try {
      await onEdit(node.id, editText)
      setEditOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '수정 실패')
    } finally {
      setSavingEdit(false)
    }
  }

  function openEdit() {
    setEditText(node.content)
    setError('')
    setEditOpen(true)
    setReplyOpen(false)
  }

  return (
    <div className="nt-comment-node">
      <div className={isReply ? 'nt-comment is-reply' : 'nt-comment'}>
        <div className="nt-comment-meta">
          <UserAvatar
            className="nt-avatar"
            src={node.authorAvatarUrl}
            label={`${authorName} 프로필 사진`}
            size="md"
          />
          <div className="nt-comment-main">
            <div className="nt-comment-info">
              <span className="nt-comment-author">{authorName}</span>
              <span className="nt-comment-date">{formatDateTime(node.createdAt)}</span>
            </div>

            {editOpen ? (
              <form onSubmit={handleEditSubmit} className="nt-comment-form nt-comment-edit-form">
                <textarea
                  className="fl-input nt-textarea"
                  aria-label="댓글 수정"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value.slice(0, 500))}
                  rows={3}
                  autoFocus
                />
                {error && <p className="fl-error">{error}</p>}
                <div className="nt-comment-form-foot">
                  <span className="nt-charcount">{editText.length}/500</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="fl-btn fl-btn-sm"
                      onClick={() => { setEditOpen(false); setError('') }}
                      disabled={savingEdit}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="fl-btn fl-btn-primary fl-btn-sm"
                      disabled={!editText.trim() || savingEdit || editText === node.content}
                    >
                      {savingEdit ? '저장 중...' : '저장'}
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <>
                <div className="nt-comment-body">{node.content}</div>
                {node.updatedAt && node.updatedAt !== node.createdAt && (
                  <span className="nt-comment-edited">수정됨</span>
                )}
              </>
            )}

            {!editOpen && <div className="nt-comment-foot">
              {isAuthenticated() && (
                <button
                  className="nt-textlink"
                  onClick={() => { setReplyOpen(!replyOpen); setReplyText(''); setError('') }}
                >
                  {replyOpen ? '취소' : '답글'}
                </button>
              )}
              {isAuthenticated() && (isAdmin() || getUsername() === node.authorUsername) && (
                <>
                  <button className="nt-textlink" onClick={openEdit}>수정</button>
                  <button className="nt-textlink nt-danger" onClick={() => onDelete(node.id)}>삭제</button>
                </>
              )}
            </div>}

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
        </div>
      </div>

      {node.replies.length > 0 && (
        <div
          className="nt-comment-replies"
          style={{ '--reply-depth': Math.min(depth + 1, 3) } as React.CSSProperties}
        >
          {node.replies.map((reply) => (
            <CommentNode
              key={reply.id}
              node={reply}
              noticeId={noticeId}
              depth={depth + 1}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
