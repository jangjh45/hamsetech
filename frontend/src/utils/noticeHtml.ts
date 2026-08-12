/*
 * 공지 본문 HTML을 다루는 작은 도구들.
 *
 * 에디터 컴포넌트와 따로 둔 이유는 번들 때문이다. 에디터(Quill)는 관리자만 쓰는데
 * 무게가 상당해서 지연 로딩으로 떼어 놨다. 이 함수들이 같은 파일에 있으면
 * 저장 검증을 하려는 것만으로 에디터가 통째로 딸려 들어와 분리가 무의미해진다.
 */

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
