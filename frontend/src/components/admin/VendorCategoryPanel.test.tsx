import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VendorCategoryPanel from './VendorCategoryPanel'

const api = vi.hoisted(() => ({
  createVendorCategory: vi.fn(),
  listAllVendorCategories: vi.fn(),
  updateVendorCategory: vi.fn(),
}))

vi.mock('../../api/vendors', () => api)

const categories = [
  { id: 1, name: '운송·택배', active: true },
  { id: 2, name: '포장재', active: false },
]

describe('업체 분류 관리 패널', () => {
  const onError = vi.fn<(message: string) => void>()
  const onNotice = vi.fn<(message: string) => void>()

  beforeEach(() => {
    vi.clearAllMocks()
    api.listAllVendorCategories.mockResolvedValue(categories)
    api.createVendorCategory.mockResolvedValue({ id: 3, name: '안전용품', active: true })
    api.updateVendorCategory.mockResolvedValue({ id: 1, name: '운송·택배', active: false })
  })

  afterEach(() => cleanup())

  it('사용 중지된 분류도 함께 보여 준다', async () => {
    render(<VendorCategoryPanel onError={onError} onNotice={onNotice} />)

    expect(await screen.findByRole('textbox', { name: '포장재 분류명' })).toBeTruthy()
    expect(screen.getByRole('textbox', { name: '운송·택배 분류명' })).toBeTruthy()
    expect(screen.getByText('사용 중지', { selector: '.fl-badge' })).toBeTruthy()
  })

  it('새 분류를 추가하면 목록을 다시 읽는다', async () => {
    render(<VendorCategoryPanel onError={onError} onNotice={onNotice} />)
    await screen.findByRole('textbox', { name: '포장재 분류명' })

    fireEvent.change(screen.getByRole('textbox', { name: '새 분류' }), { target: { value: '안전용품' } })
    fireEvent.click(screen.getByRole('button', { name: '분류 추가' }))

    await waitFor(() => expect(api.createVendorCategory).toHaveBeenCalledWith('안전용품'))
    await waitFor(() => expect(api.listAllVendorCategories).toHaveBeenCalledTimes(2))
    expect(onNotice).toHaveBeenCalledWith('분류를 추가했습니다.')
  })

  it('사용 중지 버튼은 분류를 비활성 상태로 저장한다', async () => {
    render(<VendorCategoryPanel onError={onError} onNotice={onNotice} />)
    await screen.findByRole('textbox', { name: '운송·택배 분류명' })

    fireEvent.click(screen.getByRole('button', { name: '사용 중지' }))

    await waitFor(() =>
      expect(api.updateVendorCategory).toHaveBeenCalledWith(1, { name: '운송·택배', active: false }),
    )
    expect(onNotice).toHaveBeenCalledWith('분류를 사용 중지했습니다.')
  })

  it('목록 조회가 실패하면 알림으로 전달한다', async () => {
    api.listAllVendorCategories.mockRejectedValueOnce(new Error('분류 서버 오류'))
    render(<VendorCategoryPanel onError={onError} onNotice={onNotice} />)

    await waitFor(() => expect(onError).toHaveBeenCalledWith('분류 서버 오류'))
  })
})
