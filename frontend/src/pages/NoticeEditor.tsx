import { useEffect, useState } from 'react'
import {
  createNotice,
  getNotice,
  updateNotice,
  NOTICE_CATEGORIES,
  NOTICE_CATEGORY_LABELS,
  type NoticeCategory,
} from '../api/notices'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { isAdmin, getDisplayName } from '../auth/token'
import { uploadAttachment, type NoticeAttachment } from '../api/noticeAttachments'
import RichTextEditor, { isEmptyHtml, plainTextToHtml } from '../components/RichTextEditor'
import NoticeAttachmentList from '../components/NoticeAttachmentList'
import '../styles/notices.css'

export default function NoticeEditorPage() {
  const { id } = useParams()
  const editId = id ? Number(id) : undefined
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState<NoticeCategory>('GENERAL')
  const [pinned, setPinned] = useState(false)
  const [attachments, setAttachments] = useState<NoticeAttachment[]>([])
  // 본문에 넣은 이미지의 id. 서버도 본문에서 직접 찾아내지만, 화면에서도 함께 보낸다.
  const [imageIds, setImageIds] = useState<number[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // 편집기는 초기값을 한 번만 받으므로, 불러오기 전에는 띄우지 않는다
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // 서버도 관리자만 받지만, 권한 없는 사람에게 빈 폼을 보여줄 이유가 없다
    if (!isAdmin()) {
      navigate('/notices', { replace: true })
      return
    }
    if (!editId) {
      setReady(true)
      return
    }
    getNotice(editId).then((n) => {
      setTitle(n.title)
      // 리치 텍스트 도입 전에 쓰인 글은 평문이라 문단으로 옮겨 줘야
      // 편집기에서 줄바꿈이 살아난다
      setContent(n.contentFormat === 'TEXT' ? plainTextToHtml(n.content) : n.content)
      setCategory(n.category)
      setPinned(n.pinned)
      setAttachments(n.attachments)
      setReady(true)
    })
  }, [editId, navigate])

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // 같은 파일을 다시 골라도 change가 나도록 비운다
    if (files.length === 0) return

    setError('')
    setUploading(true)
    try {
      for (const file of files) {
        const att = await uploadAttachment(file, 'FILE')
        setAttachments((prev) => [...prev, att])
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '첨부파일 업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  // 목록에서 빼기만 한다. 실제 삭제는 저장할 때 서버가 정리하고,
  // 저장하지 않고 나가면 고아 정리가 나중에 치운다.
  function onRemoveAttachment(id: number) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('제목을 입력해주세요.')
      return
    }
    // 편집기는 빈 상태에서도 <p><br></p>를 내보내므로 태그를 걷어내고 판단한다
    if (isEmptyHtml(content)) {
      setError('내용을 입력해주세요.')
      return
    }
    // 목록에 남은 첨부 + 본문에 넣은 이미지
    const attachmentIds = [...new Set([...attachments.map((a) => a.id), ...imageIds])]

    try {
      setSubmitting(true)
      if (editId) {
        await updateNotice(editId, { title, content, category, pinned, attachmentIds })
        navigate(`/notice/${editId}`)
      } else {
        const res = await createNotice({ title, content, category, pinned, attachmentIds })
        navigate(`/notice/${res.id}`)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '저장 실패')
      setSubmitting(false)
    }
  }

  const author = getDisplayName()

  return (
    <div className="fl-page">
      <div className="fl-titleband">
        <div>
          <h1>공지 {editId ? '수정' : '등록'}</h1>
          {author && <p>작성자 {author}</p>}
        </div>
      </div>

      <form className="fl-card" onSubmit={onSubmit}>
        <div className="fl-card-body" style={{ gap: 18 }}>
          <div className="nt-field">
            <span className="nt-field-label">
              제목
              <span className="nt-charcount">{title.length}/200</span>
            </span>
            <input
              className="fl-input nt-input-lg"
              placeholder="공지 제목을 입력하세요"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="nt-editor-row">
            <div className="nt-field">
              <span className="nt-field-label">분류</span>
              <select
                className="fl-input nt-input-lg"
                value={category}
                onChange={(e) => setCategory(e.target.value as NoticeCategory)}
              >
                {NOTICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {NOTICE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>

            <label className="nt-checkfield">
              <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} />
              <span>
                상단 고정
                <em>목록 맨 위에 '공지'로 표시됩니다</em>
              </span>
            </label>
          </div>

          <div className="nt-field">
            <span className="nt-field-label">내용</span>
            {ready && (
              <RichTextEditor
                initialHtml={content}
                onChange={setContent}
                onImageUploaded={(id) => setImageIds((prev) => [...prev, id])}
                placeholder="공지 내용을 입력하세요"
              />
            )}
          </div>

          <div className="nt-field">
            <span className="nt-field-label">
              첨부파일
              <span className="nt-charcount">개당 최대 20MB</span>
            </span>
            <label className="nt-filepick">
              <input type="file" multiple onChange={onPickFiles} disabled={uploading} />
              <span>{uploading ? '업로드 중...' : '파일 선택'}</span>
            </label>
            <NoticeAttachmentList attachments={attachments} onRemove={onRemoveAttachment} />
          </div>

          {error && <p className="fl-error">{error}</p>}
        </div>

        <div className="nt-actions">
          <Link className="fl-btn" to={editId ? `/notice/${editId}` : '/notices'}>
            취소
          </Link>
          <div className="nt-actions-right">
            <button className="fl-btn fl-btn-primary" type="submit" disabled={submitting}>
              {submitting ? '저장 중...' : editId ? '수정' : '등록'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
