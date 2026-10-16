import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { StrictMode } from 'react'
import RecentNotices from './RecentNotices'

const api = vi.hoisted(() => ({ listNotices: vi.fn() }))
vi.mock('../api/notices', () => ({ listNotices: api.listNotices }))

const emptyResponse = { pinned: [], page: { content: [] } }

describe('RecentNotices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listNotices.mockResolvedValue(emptyResponse)
  })

  afterEach(() => cleanup())

  it('로딩 중임을 알리고 성공하면 공지가 없다는 상태를 표시한다', async () => {
    render(<StrictMode><MemoryRouter><RecentNotices /></MemoryRouter></StrictMode>)
    expect(screen.getByRole('status').textContent).toContain('불러오는 중')
    expect(await screen.findByText('공지사항이 없습니다.')).toBeTruthy()
    expect(api.listNotices).toHaveBeenCalledTimes(1)
  })

  it('조회 실패와 빈 목록을 구분하고 다시 시도할 수 있다', async () => {
    api.listNotices.mockRejectedValueOnce(new Error('공지 API 오류')).mockResolvedValue(emptyResponse)
    render(<StrictMode><MemoryRouter><RecentNotices /></MemoryRouter></StrictMode>)

    expect((await screen.findByRole('alert')).textContent).toContain('공지 API 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(api.listNotices).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('공지사항이 없습니다.')).toBeTruthy()
  })
})
