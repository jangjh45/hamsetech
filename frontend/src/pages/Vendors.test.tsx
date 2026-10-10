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
})
