import { useEffect, useMemo, useRef, useState } from 'react'
import type { NoticeContentFormat } from '../api/notices'
import { apiFetchBlob } from '../api/client'

interface Props {
  content: string
  contentFormat: NoticeContentFormat
}

/** 이미지가 많은 글에서 브라우저 커넥션을 다 쓰지 않도록 동시 요청을 묶어 둔다. */
const MAX_PARALLEL_IMAGES = 4

const ATTACHMENT_SRC = /\/api\/notices\/attachments\/\d{1,19}\/content/g

async function runWithConcurrency<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let cursor = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      await task(items[cursor++])
    }
  })
  await Promise.all(workers)
}

/**
 * 공지 본문 렌더러.
 *
 * 리치 텍스트 도입 전에 쓰인 글은 줄바꿈이 \n인 평문이라, HTML로 그리면 문단이
 * 통째로 한 줄이 된다. 그래서 저장 형식을 글마다 기록해 두고 여기서 갈라 그린다.
 *
 * HTML은 서버(NoticeHtmlSanitizer)에서 화이트리스트로 걸러진 것만 내려온다.
 * 여기서 다시 거르지 않는 이유는 새니타이징을 브라우저에 두면 API를 직접 호출하는
 * 경로로 그대로 뚫리기 때문이고, 신뢰 지점을 서버 한 곳으로 모으는 편이 낫다.
 */
export default function NoticeHtmlView({ content, contentFormat }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // 본문에 들어 있는 첨부 이미지 주소
  const imagePaths = useMemo(() => {
    if (contentFormat !== 'HTML') return []
    return [...new Set(content.match(ATTACHMENT_SRC) ?? [])]
  }, [content, contentFormat])

  // 첨부 이미지는 인증이 필요한데 <img src>에는 Authorization 헤더를 붙일 수 없다.
  // 그래서 직접 받아 blob 주소로 바꿔 끼운다 (엑셀 다운로드와 같은 방식).
  //
  // 렌더된 DOM을 건드리지 않고 HTML 문자열을 먼저 고쳐서 넣는다. dangerouslySetInnerHTML로
  // 그린 DOM은 React 소유라, 리렌더나 StrictMode의 재마운트가 일어나면 손댄 내용이
  // 원래대로 돌아가 이미지가 인증 없이 다시 요청되고 401이 난다.
  const [blobByPath, setBlobByPath] = useState<Record<string, string>>({})

  useEffect(() => {
    if (imagePaths.length === 0) {
      setBlobByPath({})
      return
    }

    let cancelled = false
    const created: string[] = []
    const resolved: Record<string, string> = {}

    void runWithConcurrency(imagePaths, MAX_PARALLEL_IMAGES, async (path) => {
      try {
        const blob = await apiFetchBlob(path)
        if (cancelled) return
        const url = URL.createObjectURL(blob)
        created.push(url)
        resolved[path] = url
      } catch {
        // 한 장 실패해도 나머지 본문은 그대로 보여 준다
      }
    }).then(() => {
      if (!cancelled) setBlobByPath(resolved)
    })

    return () => {
      cancelled = true
      // 해제하지 않으면 공지를 옮겨 다닐수록 메모리가 계속 늘어난다
      created.forEach(URL.revokeObjectURL)
    }
  }, [imagePaths])

  // 이미지를 다 받기 전에는 src를 비워 둔다. 상대 경로 그대로 두면 브라우저가
  // 토큰 없이 먼저 요청해 401이 찍힌다.
  const html = useMemo(() => {
    if (contentFormat !== 'HTML') return content
    if (imagePaths.length === 0) return content
    return content.replace(ATTACHMENT_SRC, (path) => blobByPath[path] ?? '')
  }, [content, contentFormat, imagePaths, blobByPath])

  // 링크는 새 탭으로 열리는데, opener를 남겨 두면 열린 페이지가 원래 탭을 조작할 수 있다.
  //
  // 의존성 배열을 두지 않는 이유: React는 dangerouslySetInnerHTML로 그린 내용을
  // 리렌더마다 다시 적는다. __html 문자열이 완전히 같아도 초기화가 일어난다
  // (ReactDOM이 문자열 동일성은 보고 DOM을 건드리지 않아야 하는데, 실제로는
  // 초기화된다 — blob 주소를 고치는 리렌더가 대표적이다). 그래서 [html]로 두면
  // 첫 마운트 때 붙인 rel이 곧바로 지워지고 끝까지 다시 안 붙는다.
  //
  // 위의 이미지 처리와 같은 이유로 "DOM을 손대는 쪽은 다음 렌더에서 지워진다"를
  // 감안해야 한다. 이미지는 HTML 문자열을 고쳐 넣어서 버티지만, 링크는 속성 하나이므로
  // 매 커밋 뒤에 다시 붙이는 편이 낫다. 쿼리 대상이 공지 본문 하나로 한정돼서
  // 비용도 무시할 만하다.
  useEffect(() => {
    if (contentFormat !== 'HTML' || !ref.current) return
    ref.current.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]').forEach((a) => {
      a.rel = 'noopener noreferrer'
    })
  })

  if (contentFormat === 'TEXT') {
    // .nt-article-body의 white-space: pre-wrap이 줄바꿈을 살린다
    return <div className="nt-article-body">{content}</div>
  }

  // ql-editor를 함께 붙여 Quill의 리스트/정렬/들여쓰기 스타일을 그대로 쓴다.
  // 이게 없으면 에디터에서 만든 불릿이 상세 화면에서 마커 없이 나온다.
  return (
    <div
      ref={ref}
      className="nt-article-body nt-article-html ql-editor"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
