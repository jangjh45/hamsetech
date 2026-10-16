import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import NoticesPage from './Notices'

const api = vi.hoisted(() => ({ listNotices: vi.fn() }))

vi.mock('../api/notices', () => ({
  ...api,
  NOTICE_CATEGORIES: ['GENERAL', 'HR', 'SAFETY', 'FACILITY', 'EVENT', 'SYSTEM'],
  NOTICE_CATEGORY_LABELS: {
    GENERAL: '일반', HR: '인사·총무', SAFETY: '안전·보건',
    FACILITY: '설비·시설', EVENT: '행사·경조', SYSTEM: '전산·시스템',
  },
}))
vi.mock('../auth/token', () => ({ isAdmin: () => false }))

const emptyResponse = {
  pinned: [],
  pinnedTotal: 0,
  page: { content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 },
}

describe('공지사항 목록', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listNotices.mockResolvedValue(emptyResponse)
  })

  afterEach(() => cleanup())

  it('검색·분류·페이지를 URL에 유지하고 상세 링크에도 전달한다', async () => {
    api.listNotices.mockResolvedValue({
      pinned: [],
      pinnedTotal: 1,
      page: {
        content: [{
          id: 12, title: '안전 점검 안내', category: 'HR', pinned: false,
          viewCount: 3, authorUsername: 'admin', createdAt: '2026-10-01T00:00:00Z',
          updatedAt: '2026-10-01T00:00:00Z', commentCount: 0, attachmentCount: 0,
        }],
        totalElements: 11, totalPages: 2, number: 1, size: 10,
      },
    })

    render(
      <MemoryRouter initialEntries={['/notices?q=safety&category=HR&page=1']}>
        <NoticesPage />
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: /안전 점검 안내/ })
    expect(link.getAttribute('href')).toBe('/notice/12?q=safety&category=HR&page=1')
    expect(screen.getByText('전체 12건')).toBeTruthy()
    expect(api.listNotices).toHaveBeenCalledWith(1, 10, 'safety', 'HR')
  })

  it('목록 요청 실패를 알리고 다시 시도할 수 있다', async () => {
    api.listNotices.mockRejectedValueOnce(new Error('서버 오류')).mockResolvedValue(emptyResponse)

    render(
      <MemoryRouter initialEntries={['/notices']}>
        <NoticesPage />
      </MemoryRouter>,
    )

    expect((await screen.findByRole('alert')).textContent).toContain('서버 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(api.listNotices).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('게시글이 없습니다.')).toBeTruthy()
  })
})
