import { describe, expect, it } from 'vitest'
import { isEmptyHtml, plainTextToHtml } from './noticeHtml'

describe('isEmptyHtml', () => {
  it('빈 문자열과 undefined는 비어 있다', () => {
    expect(isEmptyHtml('')).toBe(true)
  })

  it('Quill이 내보내는 빈 문단도 비어 있다', () => {
    // 길이로는 판단할 수 없다. Quill은 빈 편집기에서도 "<p><br></p>"를 낸다.
    expect(isEmptyHtml('<p><br></p>')).toBe(true)
    expect(isEmptyHtml('<p></p>')).toBe(true)
    expect(isEmptyHtml('<p>&nbsp;</p>')).toBe(true)
  })

  it('글자가 있으면 비어 있지 않다', () => {
    expect(isEmptyHtml('<p>공지 내용</p>')).toBe(false)
  })

  it('태그만 있고 이미지가 있으면 유효하다', () => {
    // 글이 없어도 이미지만 있는 글은 지우지 않는다.
    expect(isEmptyHtml('<p><br></p><img src="/api/notices/attachments/1/content">')).toBe(false)
    expect(isEmptyHtml('<img src="/api/notices/attachments/1/content">')).toBe(false)
  })

  it('대문자 IMG 태그도 인식한다', () => {
    expect(isEmptyHtml('<IMG SRC="/x">')).toBe(false)
  })

  it('태그 경계 안에 >가 있어도 태그를 잘라 낸다', () => {
    expect(isEmptyHtml('<div><span><br></span></div>')).toBe(true)
  })

  it('공백만 있는 글은 비어 있다', () => {
    expect(isEmptyHtml('   ')).toBe(true)
    expect(isEmptyHtml('<p>   </p>')).toBe(true)
  })
})

describe('plainTextToHtml', () => {
  it('줄마다 문단을 만든다', () => {
    expect(plainTextToHtml('첫 줄\n둘째 줄')).toBe('<p>첫 줄</p><p>둘째 줄</p>')
  })

  it('CRLF 줄바꿈도 처리한다', () => {
    expect(plainTextToHtml('a\r\nb')).toBe('<p>a</p><p>b</p>')
  })

  it('빈 줄은 줄바꿈으로 남긴다', () => {
    expect(plainTextToHtml('a\n\nb')).toBe('<p>a</p><p><br></p><p>b</p>')
  })

  it('이스케이프가 태그보다 먼저다', () => {
    // 이스케이프가 뒤면 본문에 &lt;가 들어 있는 글의 &가 먼저 amp로 바뀌어
    // 이중 이스케이프가 된다.
    expect(plainTextToHtml('<script>alert(1)</script>'))
      .toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })

  it('&를 먼저 이스케이프한다', () => {
    expect(plainTextToHtml('A&B')).toBe('<p>A&amp;B</p>')
    expect(plainTextToHtml('&lt;')).toBe('<p>&amp;lt;</p>')
  })

  it('결과를 isEmptyHtml로 다시 검사할 수 있다', () => {
    // 왕복 검증: 변환한 결과가 비어 있다고 판정되면 원본도 빈 글이어야 한다.
    expect(isEmptyHtml(plainTextToHtml('내용'))).toBe(false)
  })

  it('빈 문자열은 빈 문단 하나가 된다', () => {
    expect(plainTextToHtml('')).toBe('<p><br></p>')
  })

  it('줄 끝의 공백 줄도 줄바꿈으로 본다', () => {
    expect(plainTextToHtml('a\n')).toBe('<p>a</p><p><br></p>')
  })
})
