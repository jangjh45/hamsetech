import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import CommentNode, { type CommentNodeData } from './CommentNode'

vi.mock('../auth/token', () => ({
  isAuthenticated: () => false,
  isAdmin: () => false,
  getUsername: () => null,
}))

afterEach(cleanup)

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
      <CommentNode node={node} noticeId={1} onReply={onReply} onDelete={onDelete} />,
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
        onDelete={vi.fn(async () => {})}
      />,
    )

    expect(screen.getByRole('img', { name: '김철수 프로필 사진' })).toBeTruthy()
    expect(container.querySelector('.ua-avatar-icon')).toBeTruthy()
    expect(container.querySelector('.ua-avatar img')).toBeNull()
  })
})
