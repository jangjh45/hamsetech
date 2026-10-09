import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import NoticeHtmlView from './NoticeHtmlView'
import { apiFetchBlob } from '../api/client'

// 본문이 서버에서 온 문자열이므로 apiFetchBlob만 통째로 대체한다. 나머지 모듈은
// 이 컴포넌트가 정말 쓰는 경로 그대로 둔다.
vi.mock('../api/client', () => ({ apiFetchBlob: vi.fn() }))

const blob = () => new Blob(['x'], { type: 'image/png' })
const mockFetch = vi.mocked(apiFetchBlob)

let created: string[]
let revoked: string[]

beforeEach(() => {
  created = []
  revoked = []
  mockFetch.mockReset()
  // jsdom에는 createObjectURL이 없다. 실제로 만들어지지는 않으므로 이름을
  // 지어내는 것으로 충분하다 — 다만 "몇 개를 만들고 몇 개를 해제했는가"를
  // 세려면 목록이 필요하므로 여기에 쌓아 둔다.
  URL.createObjectURL = vi.fn(() => {
    const url = `blob:mock/${created.length}`
    created.push(url)
    return url
  })
  URL.revokeObjectURL = vi.fn((url: string) => {
    revoked.push(url)
  })
})

afterEach(cleanup)

/** 본문에 들어갈 첨부 이미지 주소 n개를 만든다. */
function htmlWithImages(n: number) {
  return Array.from(
    { length: n },
    (_, i) => `<p><img src="/api/notices/attachments/${i + 1}/content"></p>`,
  ).join('')
}

describe('NoticeHtmlView — 저장 형식에 따른 렌더', () => {
  it('평문 글은 HTML로 해석하지 않는다', () => {
    // 리치 텍스트 도입 전에 쓴 글은 줄바꿈이 \n인 평문이다. HTML로 그리면
    // 문단 통째로 한 줄이 되고, 태그가 들어 있어도 글자 그대로 보여야 한다.
    const { container } = render(
      <NoticeHtmlView content={'<b>굵게</b>\n둘째 줄'} contentFormat="TEXT" />,
    )
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toBe('<b>굵게</b>\n둘째 줄')
  })

  it('HTML 글은 서버가 내려준 마크업을 그대로 그린다', () => {
    const { container } = render(
      <NoticeHtmlView content='<p><strong>중요</strong></p>' contentFormat="HTML" />,
    )
    expect(container.querySelector('strong')?.textContent).toBe('중요')
  })

  it('TARGET=_blank 링크에 noopener를 붙인다', async () => {
    // rel을 안 붙이면 열린 페이지가 원래 탭을 window.opener로 조작할 수 있다.
    render(
      <NoticeHtmlView
        content='<a href="https://example.com" target="_blank">외부</a>'
        contentFormat="HTML"
      />,
    )
    await waitFor(() => {
      expect(document.querySelector('a')?.rel).toBe('noopener noreferrer')
    })
  })
})

describe('NoticeHtmlView — 첨부 이미지 인증', () => {
  it('blob을 받기 전에는 src를 비워 둔다', () => {
    // 상대 경로를 그대로 두면 브라우저가 토큰 없이 먼저 요청해 401이 찍힌다.
    mockFetch.mockReturnValue(new Promise(() => {})) // 영원히 대기
    const { container } = render(
      <NoticeHtmlView content={htmlWithImages(1)} contentFormat="HTML" />,
    )
    expect(container.querySelector('img')?.getAttribute('src')).toBe('')
  })

  it('받은 blob 주소로 src를 바꾼다', async () => {
    mockFetch.mockResolvedValue(blob())
    const { container } = render(
      <NoticeHtmlView content={htmlWithImages(1)} contentFormat="HTML" />,
    )
    await waitFor(() => {
      expect(container.querySelector('img')?.getAttribute('src')).toBe(created[0])
    })
    expect(mockFetch).toHaveBeenCalledWith('/api/notices/attachments/1/content')
  })

  it('같은 주소가 여러 번 나와도 한 번만 받는다', async () => {
    mockFetch.mockResolvedValue(blob())
    render(
      <NoticeHtmlView
        content={'<img src="/api/notices/attachments/1/content"><img src="/api/notices/attachments/1/content">'}
        contentFormat="HTML"
      />,
    )
    await waitFor(() => expect(created).toHaveLength(1))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('이미지가 없으면 첨부 API를 부르지 않는다', async () => {
    render(<NoticeHtmlView content='<p>그냥 글</p>' contentFormat="HTML" />)
    await waitFor(() => expect(mockFetch).not.toHaveBeenCalled())
  })

  it('한 장이 실패해도 나머지 이미지는 그대로 붙는다', async () => {
    // apiFetchBlob의 첫 인자는 RequestInfo | URL이라 여기서 string으로 좁힌다.
    mockFetch.mockImplementation((input) => {
      const path = String(input)
      return path.endsWith('/2/content')
        ? Promise.reject(new Error('404'))
        : Promise.resolve(blob())
    })
    const { container } = render(
      <NoticeHtmlView content={htmlWithImages(2)} contentFormat="HTML" />,
    )
    // 1번은 붙고 2번은 src가 빈 채로 남는다 — 본문 전체가 사라지지는 않는다.
    await waitFor(() => {
      const srcs = [...container.querySelectorAll('img')].map((i) => i.getAttribute('src'))
      expect(srcs[0]).toBe(created[0])
      expect(srcs[1]).toBe('')
    })
    expect(container.querySelectorAll('p')).toHaveLength(2)
  })
})

describe('NoticeHtmlView — 동시 요청 제한', () => {
  it('이미지를 한 번에 4개 넘게 받지 않는다', async () => {
    // 이미지가 많은 글에서 브라우저 커넥션을 다 쓰지 않도록 묶어 두는 것이
    // 이 컴포넌트의 목적이다. 12장으로_requests해 상한을 실제로 확인한다.
    let inFlight = 0
    let peak = 0
    const gates: Array<() => void> = []
    mockFetch.mockImplementation(() => {
      inFlight++
      peak = Math.max(peak, inFlight)
      return new Promise<Blob>((resolve) => {
        gates.push(() => {
          inFlight--
          resolve(blob())
        })
      })
    })

    render(<NoticeHtmlView content={htmlWithImages(12)} contentFormat="HTML" />)

    // 4개가 차면 더는 시작되지 않는다.
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(4))
    await new Promise((r) => setTimeout(r, 10))
    expect(mockFetch).toHaveBeenCalledTimes(4)
    expect(peak).toBe(4)

    // 하나씩 풀어 주면 나머지가 이어서 시작된다.
    for (let i = 0; i < 12; i++) {
      gates.shift()?.()
      await new Promise((r) => setTimeout(r, 0))
    }
    await waitFor(() => expect(created).toHaveLength(12))
    expect(peak).toBe(4)
  })
})

describe('NoticeHtmlView — blob 주소 해제', () => {
  it('화면에서 떠나면 만든 blob 주소를 모두 해제한다', async () => {
    // 해제하지 않으면 공지를 옮겨 다닐수록 메모리가 계속 늘어난다.
    mockFetch.mockResolvedValue(blob())
    const view = render(
      <NoticeHtmlView content={htmlWithImages(3)} contentFormat="HTML" />,
    )
    await waitFor(() => expect(created).toHaveLength(3))

    view.unmount()
    expect(revoked.sort()).toEqual(created.sort())
  })

  it('글을 바꿔도 이전 글의 blob 주소를 해제한다', async () => {
    mockFetch.mockResolvedValue(blob())
    const view = render(
      <NoticeHtmlView content={htmlWithImages(2)} contentFormat="HTML" />,
    )
    await waitFor(() => expect(created).toHaveLength(2))

    view.rerender(
      <NoticeHtmlView content={htmlWithImages(5)} contentFormat="HTML" />,
    )
    await waitFor(() => expect(created).toHaveLength(7))
    expect(revoked.sort()).toEqual(created.slice(0, 2).sort())
  })
})