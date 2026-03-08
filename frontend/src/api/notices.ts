import { apiFetch } from './client'

export interface Notice {
  id: number
  title: string
  content: string
  authorUsername: string
  authorDisplayName?: string
  createdAt: string
  updatedAt: string
}

export interface NoticeComment {
  id: number
  content: string
  authorUsername: string
  parentId: number | null
  createdAt: string
}

export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export async function listNotices(page = 0, size = 10, q = ''): Promise<Page<Notice>> {
  const params = new URLSearchParams({ page: String(page), size: String(size), q })
  return apiFetch(`/api/notices?${params.toString()}`)
}

export async function getNotice(id: number): Promise<Notice> {
  return apiFetch(`/api/notices/${id}`)
}

export async function createNotice(data: { title: string; content: string }): Promise<Notice> {
  return apiFetch(`/api/notices`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateNotice(id: number, data: { title: string; content: string }): Promise<Notice> {
  return apiFetch(`/api/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteNotice(id: number): Promise<void> {
  return apiFetch(`/api/notices/${id}`, { method: 'DELETE' })
}

export async function listComments(id: number): Promise<NoticeComment[]> {
  return apiFetch(`/api/notices/${id}/comments`)
}

export async function addComment(id: number, data: { content: string; parentId?: number }): Promise<NoticeComment> {
  return apiFetch(`/api/notices/${id}/comments`, { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteComment(noticeId: number, commentId: number): Promise<void> {
  return apiFetch(`/api/notices/${noticeId}/comments/${commentId}`, { method: 'DELETE' })
}
