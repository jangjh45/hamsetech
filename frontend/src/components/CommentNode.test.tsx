import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import CommentNode, { type CommentNodeData } from './CommentNode'

vi.mock('../auth/token', () => ({
  isAuthenticated: () => Boolean(localStorage.getItem('auth_token')),
  isAdmin: () => false,
  getUsername: () => localStorage.getItem('auth_username'),
}))

afterEach(() => {
  cleanup()
  localStorage.clear()
})

const node: CommentNodeData = {
  id: 1,
  content: '댓글 내용',
  authorUsername: 'kim',
  authorDisplayName: '김철수',
  authorAvatarUrl: '/api/users/avatars/8f3b0e7f-7cae-4b66-b4a3-c62815de4440',
  parentId: null,
  createdAt: '2026-10-10T10:00:00Z',
  replies: [],
}

describe('CommentNode 아바타', () => {
  it('작성자 사진과 표시 이름을 사용한다', () => {
    const onReply = vi.fn(async () => {})
    const onDelete = vi.fn(async () => {})
    const { container } = render(
      <CommentNode
        node={node}
        noticeId={1}
        onReply={onReply}
        onEdit={vi.fn(async () => {})}
        onDelete={onDelete}
      />,
    )

    expect(screen.getByRole('img', { name: '김철수 프로필 사진' })).toBeTruthy()
    expect(container.querySelector('.ua-avatar img')?.getAttribute('src')).toBe(node.authorAvatarUrl)
    expect(screen.getByText('김철수')).toBeTruthy()
  })

  it('사진 URL이 없으면 기본 아이콘을 표시한다', () => {
    const { container } = render(
      <CommentNode
        node={{ ...node, authorAvatarUrl: null }}
        noticeId={1}
        onReply={vi.fn(async () => {})}
        onEdit={vi.fn(async () => {})}
        onDelete={vi.fn(async () => {})}
      />,
    )

    expect(screen.getByRole('img', { name: '김철수 프로필 사진' })).toBeTruthy()
    expect(container.querySelector('.ua-avatar-icon')).toBeTruthy()
    expect(container.querySelector('.ua-avatar img')).toBeNull()
  })

  it('작성자 본인이 댓글을 수정하고 저장할 수 있다', async () => {
    localStorage.setItem('auth_token', 'token')
    localStorage.setItem('auth_username', 'kim')
    const onEdit = vi.fn(async () => {})
    render(
      <CommentNode
        node={node}
        noticeId={1}
        onReply={vi.fn(async () => {})}
        onEdit={onEdit}
        onDelete={vi.fn(async () => {})}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '수정' }))
    fireEvent.change(screen.getByRole('textbox', { name: '댓글 수정' }), {
      target: { value: '고친 댓글 내용' },
    })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith(1, '고친 댓글 내용'))
  })
})
