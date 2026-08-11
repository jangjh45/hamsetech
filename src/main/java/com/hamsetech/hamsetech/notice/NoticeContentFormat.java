package com.hamsetech.hamsetech.notice;

/**
 * 본문 저장 형식.
 *
 * WYSIWYG 도입 전에 작성된 글은 줄바꿈이 \n인 평문이라 HTML로 렌더하면 한 줄로 뭉개진다.
 * 일괄 변환은 본문에 &lt;나 &amp;를 쓴 글을 망치므로, 형식을 글마다 기록해 두고
 * 렌더링 시점에 분기한다. 기존 글은 TEXT로 남고, 저장을 거치면 HTML로 승격된다.
 */
public enum NoticeContentFormat {
    TEXT,
    HTML
}
