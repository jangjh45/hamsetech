import { apiFetch } from './client'

export type VendorCategory = {
  id: number
  name: string
  active: boolean
}

export type VendorContact = {
  id?: number
  name: string
  department: string
  position: string
  phone: string
  mobile: string
  email: string
  memo: string
  primary: boolean
}

export type VendorContactInput = Omit<VendorContact, 'id'> & { id?: number }

export type VendorSummary = {
  id: number
  name: string
  categoryId: number
  categoryName: string
  mainPhone: string | null
  mainEmail: string | null
  primaryContactName: string | null
  primaryContactPhone: string | null
}

export type Vendor = {
  id: number
  name: string
  categoryId: number
  categoryName: string
  businessRegistrationNo: string | null
  mainPhone: string | null
  mainEmail: string | null
  address: string | null
  website: string | null
  memo: string | null
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  contacts: VendorContact[]
}

export type VendorInput = {
  name: string
  categoryId: number
  businessRegistrationNo: string
  mainPhone: string
  mainEmail: string
  address: string
  website: string
  memo: string
  contacts: VendorContactInput[]
}

export type VendorPage = {
  content: VendorSummary[]
  number: number
  size: number
  totalElements: number
  totalPages: number
}

export async function listVendors(
  page: number,
  size: number,
  query: string,
  categoryId?: number,
): Promise<VendorPage> {
  const params = new URLSearchParams({ page: String(page), size: String(size) })
  if (query.trim()) params.set('q', query.trim())
  if (categoryId !== undefined) params.set('categoryId', String(categoryId))
  return apiFetch(`/api/vendors?${params.toString()}`)
}

export async function getVendor(id: number): Promise<Vendor> {
  return apiFetch(`/api/vendors/${id}`)
}

export async function createVendor(input: VendorInput): Promise<Vendor> {
  return apiFetch('/api/vendors', { method: 'POST', body: JSON.stringify(input) })
}

export async function updateVendor(id: number, input: VendorInput): Promise<Vendor> {
  return apiFetch(`/api/vendors/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}

export async function listVendorCategories(): Promise<VendorCategory[]> {
  return apiFetch('/api/vendor-categories')
}

export async function listAllVendorCategories(): Promise<VendorCategory[]> {
  return apiFetch('/api/vendor-categories/manage')
}

export async function createVendorCategory(name: string): Promise<VendorCategory> {
  return apiFetch('/api/vendor-categories', { method: 'POST', body: JSON.stringify({ name }) })
}

export async function updateVendorCategory(
  id: number,
  input: Pick<VendorCategory, 'name' | 'active'>,
): Promise<VendorCategory> {
  return apiFetch(`/api/vendor-categories/${id}`, { method: 'PUT', body: JSON.stringify(input) })
}
