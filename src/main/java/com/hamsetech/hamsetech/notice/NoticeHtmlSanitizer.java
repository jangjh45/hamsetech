package com.hamsetech.hamsetech.notice;

import org.owasp.html.CssSchema;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.regex.Pattern;

/**
 * 공지 본문 HTML 새니타이저.
 *
 * 리치 텍스트 에디터가 붙으면서 상세 화면이 본문을 HTML로 그리게 됐다. 브라우저에서
 * 거르는 것은 API를 직접 호출하면 그대로 뚫리므로, 저장 직전 서버에서 한 번 정리한다.
 * 화이트리스트 방식이라 여기 없는 태그·속성은 전부 사라진다.
 */
@Component
public class NoticeHtmlSanitizer {

    /**
     * 본문 이미지의 src로 허용할 경로.
     *
     * 우리 첨부 엔드포인트만 통과시켜서 base64 인라인(DB 폭증), 외부 도메인(추적 픽셀),
     * javascript: 스킴을 한꺼번에 막는다.
     */
    private static final Pattern ATTACHMENT_SRC =
            Pattern.compile("^/api/notices/attachments/\\d{1,19}/content$");

    /** Quill이 정렬·들여쓰기·리스트에 쓰는 클래스만 통과시킨다. */
    private static final Pattern QUILL_CLASS =
            Pattern.compile("^\\s*(ql-[a-z0-9\\-]+\\s*)+$");

    /**
     * 허용할 인라인 CSS.
     *
     * rgb()/rgba()를 빼면 안 된다. 에디터에서 색을 고르면 값이 hex로 들어가지만,
     * 브라우저가 innerHTML로 돌려줄 때 rgb(230, 0, 0) 형태로 정규화한다.
     * CssSchema는 속성과 함수를 따로 관리해서, 함수 정의를 넣지 않으면
     * 색을 넣은 글이 저장될 때 스타일만 조용히 사라진다.
     */
    private static final List<String> ALLOWED_CSS = List.of(
            "color", "background-color", "text-align", "rgb()", "rgba()");

    private static final PolicyFactory POLICY = new HtmlPolicyBuilder()
            .allowElements(
                    "p", "br", "span", "div",
                    "strong", "b", "em", "i", "u", "s", "del",
                    "ol", "ul", "li",
                    "h1", "h2", "h3", "h4",
                    "blockquote", "pre", "code", "hr",
                    "a", "img")
            .allowAttributes("class").matching(QUILL_CLASS)
                .onElements("p", "span", "div", "li", "h1", "h2", "h3", "h4",
                            "blockquote", "pre", "img")
            // Quill 2는 불릿/번호 구분을 li의 data-list에 담는다
            .allowAttributes("data-list").matching(true, "bullet", "ordered", "unchecked", "checked")
                .onElements("li")
            .allowAttributes("href").onElements("a")
            .allowStandardUrlProtocols()          // http, https, mailto 외에는 href가 통째로 사라진다
            .requireRelNofollowOnLinks()
            .allowAttributes("target").matching(true, "_blank").onElements("a")
            .allowAttributes("src").matching(ATTACHMENT_SRC).onElements("img")
            .allowAttributes("alt", "width", "height").onElements("img")
            // 인라인 스타일은 글자색/배경색/정렬만. expression()이나 url() 같은 것은
            // CssSchema가 알아서 떨어뜨린다.
            .allowStyling(CssSchema.withProperties(ALLOWED_CSS))
            .toFactory();

    /**
     * 태그를 전부 걷어내 평문만 남긴다. 검색용 사본(content_text)을 만들 때 쓴다.
     * 허용 목록이 비어 있으므로 결과에는 텍스트 노드만 남는다.
     */
    private static final PolicyFactory TEXT_ONLY = new HtmlPolicyBuilder().toFactory();

    /** 저장 직전 한 번 호출한다. */
    public String sanitize(String rawHtml) {
        if (rawHtml == null) return "";
        return POLICY.sanitize(rawHtml);
    }

    /**
     * 검색용 평문. 태그를 지우고 나면 &amp;lt; 같은 엔티티가 남으므로 되돌려 준다.
     * 그래야 사용자가 화면에서 본 그대로의 낱말로 검색된다.
     */
    public String toPlainText(String html) {
        if (html == null) return "";
        String stripped = TEXT_ONLY.sanitize(html);
        return unescapeEntities(stripped).replaceAll("\\s+", " ").trim();
    }

    /** 새니타이저가 내보내는 기본 엔티티만 되돌린다. &amp;는 반드시 마지막이다. */
    private String unescapeEntities(String s) {
        return s.replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&#34;", "\"")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&");
    }
}
