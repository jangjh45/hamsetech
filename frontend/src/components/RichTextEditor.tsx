import { useEffect, useRef } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import { uploadAttachment } from '../api/noticeAttachments'
import '../styles/editor.css'

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  [{ align: [] }],
  ['blockquote', 'link', 'image'],
  ['clean'],
]

const IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp'
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

interface Props {
  /** 최초 1회만 반영된다. 이후 값은 onChange로만 흐른다. */
  initialHtml: string
  onChange: (html: string) => void
  /** 본문에 넣은 이미지의 첨부 id. 저장할 때 글에 붙이려고 위로 올려 준다. */
  onImageUploaded?: (attachmentId: number) => void
  placeholder?: string
}

/**
 * Quill 래퍼.
 *
 * 값을 prop으로 되받는 제어 컴포넌트로 만들면 안 된다. 타이핑할 때마다 부모가
 * 새 value를 내려주고 그때마다 편집 영역을 다시 채우게 되는데, 그러면 커서가
 * 매번 문서 맨 앞으로 튄다. 그래서 초기값만 한 번 넣고 이후에는 편집기가
 * 자기 상태를 갖는다.
 *
 * React 래퍼 라이브러리(react-quill 등)를 쓰지 않은 이유는 그쪽 peer 의존성이
 * React 18에 묶여 있어서다. Quill은 React를 모르는 라이브러리라 버전 충돌이 없다.
 */
export default function RichTextEditor({ initialHtml, onChange, onImageUploaded, placeholder }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)

  // onChange를 ref로 들고 있어야 아래 이펙트가 첫 렌더의 함수에 묶이지 않는다
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onImageUploadedRef = useRef(onImageUploaded)
  onImageUploadedRef.current = onImageUploaded

  // 초기값은 편집기가 만들어진 뒤 한 번만 넣는다
  const initialRef = useRef(initialHtml)
  initialRef.current = quillRef.current ? initialRef.current : initialHtml

  useEffect(() => {
    const container = containerRef.current
    if (!container || quillRef.current) return

    const editorEl = document.createElement('div')
    container.appendChild(editorEl)

    const quill = new Quill(editorEl, {
      theme: 'snow',
      placeholder: placeholder ?? '내용을 입력하세요',
      modules: { toolbar: TOOLBAR },
    })
    quillRef.current = quill

    if (initialRef.current) {
      quill.clipboard.dangerouslyPasteHTML(initialRef.current)
    }

    quill.on('text-change', () => {
      onChangeRef.current(quill.getSemanticHTML())
    })

    // 이미지는 서버에 올리고 그 주소만 본문에 넣는다.
    // 기본 동작은 파일을 base64로 본문에 통째로 박아 넣는데, 그러면 DB가 부풀고
    // 서버 새니타이저가 data: URL을 지워 이미지가 조용히 사라진다.
    async function insertImage(file: File) {
      if (!file.type.startsWith('image/')) return
      if (file.size > MAX_IMAGE_BYTES) {
        window.alert('이미지는 5MB 이하만 올릴 수 있습니다.')
        return
      }
      const range = quill.getSelection(true)
      const at = range ? range.index : quill.getLength()
      try {
        const att = await uploadAttachment(file, 'IMAGE')
        quill.insertEmbed(at, 'image', att.url, 'user')
        quill.setSelection(at + 1, 0)
        onImageUploadedRef.current?.(att.id)
      } catch (e) {
        window.alert('이미지 업로드 실패: ' + (e instanceof Error ? e.message : ''))
      }
    }

    const toolbar = quill.getModule('toolbar') as { addHandler: (n: string, h: () => void) => void }
    toolbar.addHandler('image', () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = IMAGE_ACCEPT
      input.onchange = () => {
        const file = input.files?.[0]
        if (file) void insertImage(file)
      }
      input.click()
    })

    // 붙여넣기·드래그드롭도 같은 경로로 보낸다.
    // 이걸 빼면 스크린샷을 Ctrl+V 하는 순간 base64가 들어가고, 저장할 때
    // 새니타이저가 지워서 이미지만 사라진 채 저장된다.
    const root = quill.root
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'))
      if (files.length === 0) return
      e.preventDefault()
      files.forEach((f) => void insertImage(f))
    }
    const onDrop = (e: DragEvent) => {
      const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
      if (files.length === 0) return
      e.preventDefault()
      files.forEach((f) => void insertImage(f))
    }
    root.addEventListener('paste', onPaste)
    root.addEventListener('drop', onDrop)

    return () => {
      root.removeEventListener('paste', onPaste)
      root.removeEventListener('drop', onDrop)
      quillRef.current = null
      // StrictMode가 이펙트를 두 번 실행할 때 편집기가 두 개 쌓이지 않게 비운다
      container.innerHTML = ''
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <div className="nt-editor" ref={containerRef} />
}

/**
 * 편집기가 비었는지.
 *
 * Quill은 빈 상태에서도 "<p><br></p>"를 내보내기 때문에 문자열 길이로는 판단할 수 없다.
 * 글자가 없어도 이미지만 있는 글은 유효하다.
 */
export function isEmptyHtml(html: string): boolean {
  if (!html) return true
  if (/<img\b/i.test(html)) return false
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === ''
}

/**
 * 평문을 문단 HTML로 옮긴다. 리치 텍스트 도입 전에 쓴 글을 편집기에 올릴 때 쓴다.
 *
 * 이스케이프가 먼저다. 본문에 <나 &가 들어 있는 글을 그대로 넣으면 태그로 해석돼
 * 내용이 깨지거나 사라진다.
 */
export function plainTextToHtml(plain: string): string {
  const escaped = plain
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return escaped
    .split(/\r?\n/)
    .map((line) => `<p>${line || '<br>'}</p>`)
    .join('')
}
