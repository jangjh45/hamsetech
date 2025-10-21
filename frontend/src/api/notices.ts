import { apiFetch } from './client'

export type Notice = { id: number; title: string; content: string; authorUsername: string; authorDisplayName?: string; createdAt: string }

export async function listNotices(page = 0, size = 10, q = '') {
  const params = new URLSearchParams({ page: String(page), size: String(size), q })
  return apiFetch(`/api/notices?${params.toString()}`)
}

export async function getNotice(id: number) {
  return apiFetch(`/api/notices/${id}`)
}

export async function createNotice(data: { title: string; content: string }) {
  return apiFetch(`/api/notices`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateNotice(id: number, data: { title: string; content: string }) {
  return apiFetch(`/api/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function deleteNotice(id: number) {
  return apiFetch(`/api/notices/${id}`, { method: 'DELETE' })
}

export async function listComments(id: number) {
  return apiFetch(`/api/notices/${id}/comments`)
}

export async function addComment(id: number, data: { content: string; parentId?: number }) {
  return apiFetch(`/api/notices/${id}/comments`, { method: 'POST', body: JSON.stringify(data) })
}

export async function deleteComment(noticeId: number, commentId: number) {
  return apiFetch(`/api/notices/${noticeId}/comments/${commentId}`, { method: 'DELETE' })
}


