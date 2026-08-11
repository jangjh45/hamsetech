import { apiFetch } from './client'
import type { NoticeAttachment } from './noticeAttachments'

export type NoticeCategory = 'GENERAL' | 'HR' | 'SAFETY' | 'FACILITY' | 'EVENT' | 'SYSTEM'

/**
 * 본문 저장 형식. WYSIWYG 도입 전에 쓰인 글은 TEXT라 평문 그대로 그려야 하고,
 * HTML은 서버에서 새니타이징을 거친 마크업이다.
 */
export type NoticeContentFormat = 'TEXT' | 'HTML'

export const NOTICE_CATEGORIES: NoticeCategory[] = [
  'GENERAL',
  'HR',
  'SAFETY',
  'FACILITY',
  'EVENT',
  'SYSTEM',
]

export const NOTICE_CATEGORY_LABELS: Record<NoticeCategory, string> = {
  GENERAL: '일반',
  HR: '인사·총무',
  SAFETY: '안전·보건',
  FACILITY: '설비·시설',
  EVENT: '행사·경조',
  SYSTEM: '전산·시스템',
}

/** 목록 한 줄. 본문(content)은 담기지 않는다. */
export interface NoticeSummary {
  id: number
  title: string
  category: NoticeCategory
  pinned: boolean
  viewCount: number
  authorUsername: string
  authorDisplayName?: string
  createdAt: string
  updatedAt: string
  commentCount: number
  attachmentCount: number
}

export interface NoticeDetail {
  id: number
  title: string
  content: string
  contentFormat: NoticeContentFormat
  category: NoticeCategory
  pinned: boolean
  viewCount: number
  authorUsername: string
  authorDisplayName?: string
  createdAt: string
  updatedAt: string
  attachments: NoticeAttachment[]
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

/**
 * 고정 공지는 페이징 밖으로 빠져 pinned에 따로 담긴다(첫 페이지에서만).
 * 덕분에 목록 화면의 글 번호 계산이 고정글 수와 무관하게 그대로 맞는다.
 */
export interface NoticeListResponse {
  pinned: NoticeSummary[]
  page: Page<NoticeSummary>
}

export interface NoticeNeighbors {
  prev: { id: number; title: string } | null
  next: { id: number; title: string } | null
}

export interface NoticeInput {
  title: string
  content: string
  category: NoticeCategory
  pinned: boolean
  /** 본문에 박힌 이미지는 서버가 알아서 찾으므로 일반 첨부만 담으면 된다. */
  attachmentIds: number[]
}

export async function listNotices(
  page = 0,
  size = 10,
  q = '',
  category?: NoticeCategory,
): Promise<NoticeListResponse> {
  const params = new URLSearchParams({ page: String(page), size: String(size), q })
  if (category) params.set('category', category)
  return apiFetch(`/api/notices?${params.toString()}`)
}

export async function getNotice(id: number): Promise<NoticeDetail> {
  return apiFetch(`/api/notices/${id}`)
}

export async function getNoticeNeighbors(id: number): Promise<NoticeNeighbors> {
  return apiFetch(`/api/notices/${id}/neighbors`)
}

export async function createNotice(data: NoticeInput): Promise<NoticeDetail> {
  return apiFetch(`/api/notices`, { method: 'POST', body: JSON.stringify(data) })
}

export async function updateNotice(id: number, data: NoticeInput): Promise<NoticeDetail> {
  return apiFetch(`/api/notices/${id}`, { method: 'PUT', body: JSON.stringify(data) })
}

export async function setNoticePinned(id: number, pinned: boolean): Promise<{ pinned: boolean }> {
  return apiFetch(`/api/notices/${id}/pin`, { method: 'PATCH', body: JSON.stringify({ pinned }) })
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
