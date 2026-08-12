import { apiFetch, apiFetchBlob, apiUpload } from './client'

export type AttachmentKind = 'IMAGE' | 'FILE'

export interface NoticeAttachment {
  id: number
  originalFilename: string
  contentType: string
  size: number
  kind: AttachmentKind
  /** 본문 img의 src이자 내려받기 주소. */
  url: string
}

export async function uploadAttachment(file: File, kind: AttachmentKind): Promise<NoticeAttachment> {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<NoticeAttachment>(`/api/notices/attachments?kind=${kind}`, form)
}

export async function deleteAttachment(id: number): Promise<void> {
  return apiFetch(`/api/notices/attachments/${id}`, { method: 'DELETE' })
}

/**
 * 첨부 내려받기.
 *
 * 토큰이 localStorage에 있어 <a href>로 바로 걸 수 없다. blob으로 받아서
 * objectURL로 링크를 만든다 (Admin.tsx의 엑셀 다운로드와 같은 방식).
 * 개발 환경은 교차 출처라 서버가 준 Content-Disposition을 읽을 수 없으므로
 * 파일명은 응답 대신 DTO의 originalFilename을 쓴다.
 */
export async function downloadAttachment(att: NoticeAttachment): Promise<void> {
  const blob = await apiFetchBlob(att.url)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = att.originalFilename
  link.click()
  URL.revokeObjectURL(url)
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
