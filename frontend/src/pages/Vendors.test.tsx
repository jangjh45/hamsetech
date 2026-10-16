import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import VendorsPage from './Vendors'

const api = vi.hoisted(() => ({
  createVendor: vi.fn(),
  createVendorCategory: vi.fn(),
  getVendor: vi.fn(),
  listAllVendorCategories: vi.fn(),
  listVendorCategories: vi.fn(),
  listVendors: vi.fn(),
  updateVendor: vi.fn(),
  updateVendorCategory: vi.fn(),
}))

vi.mock('../auth/token', () => ({ isAdmin: () => false }))
vi.mock('../api/vendors', () => api)

const emptyPage = {
  content: [],
  number: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,
}

describe('업체 주소록', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.listVendors.mockResolvedValue(emptyPage)
    api.listVendorCategories.mockResolvedValue([{ id: 1, name: '운송·택배', active: true }])
    api.createVendor.mockResolvedValue({ id: 9 })
  })

  afterEach(() => cleanup())

  it('일반 사용자가 업체를 등록할 수 있고 사업자번호·주소 없이 저장한다', async () => {
    render(<VendorsPage />)

    fireEvent.click(await screen.findByRole('button', { name: '업체 등록' }))
    fireEvent.change(screen.getByRole('textbox', { name: '업체명' }), { target: { value: '새길 운송' } })
    fireEvent.click(screen.getByRole('button', { name: '저장' }))

    await waitFor(() => expect(api.createVendor).toHaveBeenCalledOnce())
    expect(api.createVendor).toHaveBeenCalledWith(expect.objectContaining({
      name: '새길 운송',
      categoryId: 1,
      businessRegistrationNo: '',
      address: '',
      contacts: [],
    }))
  })

  it('검색된 업체와 분류를 표시한다', async () => {
    api.listVendors.mockResolvedValue({
      ...emptyPage,
      content: [{
        id: 2,
        name: '한빛 포장',
        categoryId: 1,
        categoryName: '포장재',
        mainPhone: null,
        mainEmail: null,
        primaryContactName: null,
        primaryContactPhone: null,
      }],
      totalElements: 1,
    })

    render(<VendorsPage />)

    expect(await screen.findByRole('button', { name: '한빛 포장' })).toBeTruthy()
    expect(screen.getByText('포장재')).toBeTruthy()
  })

  it('목록 조회 실패를 재시도할 수 있다', async () => {
    api.listVendors.mockRejectedValueOnce(new Error('목록 서버 오류')).mockResolvedValue(emptyPage)
    render(<VendorsPage />)

    expect((await screen.findByRole('alert')).textContent).toContain('목록 서버 오류')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await waitFor(() => expect(api.listVendors).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('등록된 업체가 없습니다.')).toBeTruthy()
  })

  it('분류 목록 실패 후 다시 불러오면 업체 등록을 사용할 수 있다', async () => {
    api.listVendorCategories
      .mockRejectedValueOnce(new Error('분류 서버 오류'))
      .mockResolvedValue([{ id: 1, name: '운송·택배', active: true }])
    render(<VendorsPage />)

    expect((await screen.findByRole('alert')).textContent).toContain('분류 서버 오류')
    expect((screen.getByRole('button', { name: '업체 등록' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: '분류 다시 불러오기' }))
    await waitFor(() => expect((screen.getByRole('button', { name: '업체 등록' }) as HTMLButtonElement).disabled).toBe(false))
  })

  it('상세 모달은 Escape로 닫히고 호출 버튼에 포커스를 돌려준다', async () => {
    api.listVendors.mockResolvedValue({
      ...emptyPage,
      content: [{
        id: 2, name: '한빛 포장', categoryId: 1, categoryName: '포장재',
        mainPhone: null, mainEmail: null, primaryContactName: null, primaryContactPhone: null,
      }],
      totalElements: 1,
    })
    api.getVendor.mockResolvedValue({
      id: 2, name: '한빛 포장', categoryId: 1, categoryName: '포장재',
      businessRegistrationNo: null, mainPhone: null, mainEmail: null, address: null,
      website: 'HTTP://example.com', memo: null, createdBy: 'admin', updatedBy: 'admin',
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', contacts: [],
    })
    render(<VendorsPage />)

    const openButton = await screen.findByRole('button', { name: '상세' })
    openButton.focus()
    fireEvent.click(openButton)
    await screen.findByRole('dialog')
    const website = await screen.findByRole('link', { name: 'HTTP://example.com' })
    expect(website.getAttribute('href')).toBe('http://example.com/')

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(openButton)
  })
})
