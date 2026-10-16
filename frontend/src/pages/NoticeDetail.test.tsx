import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiError } from '../api/client'
import NoticeDetailPage from './NoticeDetail'

const api = vi.hoisted(() => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  deleteNotice: vi.fn(),
  getNotice: vi.fn(),
  getNoticeNeighbors: vi.fn(),
  listComments: vi.fn(),
  updateComment: vi.fn(),
}))

vi.mock('../api/notices', () => ({
  ...api,
  NOTICE_CATEGORIES: ['GENERAL', 'HR', 'SAFETY', 'FACILITY', 'EVENT', 'SYSTEM'],
  NOTICE_CATEGORY_LABELS: {
    GENERAL: '일반', HR: '인사·총무', SAFETY: '안전·보건',
    FACILITY: '설비·시설', EVENT: '행사·경조', SYSTEM: '전산·시스템',
  },
}))
vi.mock('../auth/token', () => ({
  isAuthenticated: () => false,
  isAdmin: () => false,
  getUsername: () => null,
}))
vi.mock('../components/ConfirmDialog', () => ({ useConfirm: () => ({ confirm: vi.fn() }) }))
vi.mock('../components/NoticeHtmlView', () => ({ default: () => <div>공지 본문</div> }))
vi.mock('../components/NoticeAttachmentList', () => ({ default: () => null }))

const notice = {
  id: 12, title: '상세 안내', content: '<p>본문</p>', contentFormat: 'HTML' as const,
  category: 'GENERAL' as const, pinned: false, viewCount: 4,
  authorUsername: 'admin', authorDisplayName: '관리자', authorAvatarUrl: null,
  createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z', attachments: [],
}
const emptyComments = {
  content: [], totalComments: 0, totalThreads: 0, totalPages: 0, number: 0, size: 10,
}

describe('공지사항 상세', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getNotice.mockResolvedValue(notice)
    api.getNoticeNeighbors.mockResolvedValue({ prev: { id: 11, title: '이전 공지' }, next: null })
    api.listComments.mockResolvedValue(emptyComments)
  })

  afterEach(() => cleanup())

  it('일시적 오류를 없는 글로 오인하지 않고 재시도할 수 있다', async () => {
    api.getNotice.mockRejectedValueOnce(new ApiError('네트워크 오류', 503)).mockResolvedValue(notice)

    render(
      <MemoryRouter initialEntries={['/notice/12?q=안전&category=HR&page=2']}>
        <Routes>
          <Route path="/notice/:id" element={<NoticeDetailPage />} />
          <Route path="/notices" element={<div>공지 목록 화면</div>} />
        </Routes>
      </MemoryRouter>,
    )

    expect((await screen.findByRole('alert')).textContent).toContain('네트워크 오류')
    expect(screen.queryByText('존재하지 않는 게시글입니다.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(await screen.findByRole('heading', { name: '상세 안내' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '공지사항' }).getAttribute('href'))
      .toBe('/notices?q=안전&category=HR&page=2')
    await waitFor(() => expect(api.getNoticeNeighbors).toHaveBeenCalledWith(12, '안전', 'HR'))
  })

  it('댓글 스레드를 페이지 단위로 불러오고 비로그인 작성 안내를 보여준다', async () => {
    api.listComments.mockResolvedValue({
      content: [{
        id: 1, content: '첫 댓글', authorUsername: 'user', authorDisplayName: '사용자',
        authorAvatarUrl: null, parentId: null, createdAt: '2026-10-01T00:00:00Z', replies: [],
      }],
      totalComments: 11, totalThreads: 11, totalPages: 2, number: 0, size: 10,
    })

    render(
      <MemoryRouter initialEntries={['/notice/12']}>
        <Routes><Route path="/notice/:id" element={<NoticeDetailPage />} /></Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('첫 댓글')).toBeTruthy()
    expect(screen.getByText(/댓글을 작성하려면/)).toBeTruthy()
    expect(api.listComments).toHaveBeenCalledWith(12, 0)
    await waitFor(() => expect(screen.getByRole('button', { name: '2' })).toBeTruthy())
  })
})
