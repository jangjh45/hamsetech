package com.hamsetech.hamsetech.notice;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 공지 본문 새니타이저 단위 테스트.
 *
 * 여기가 이 애플리케이션에서 유일하게 "외부 입력을 HTML로 받아 렌더링하는" 경계다.
 * 리치 텍스트 에디터가 붙은 뒤로 여기서 통과시킨 마크업이 그대로 상세 화면에
 * 그려지므로, 화이트리스트 규칙 하나가 어긋나면 곧바로 저장형 XSS가 된다.
 * 반대로 규칙이 과하면 조용히_styles만 사라져 아무도 모른다 — 그래서 양쪽을 다 건다.
 *
 * 의존성이 없어 Spring 없이 직접 생성한다.
 * (OvertimeRecordServiceTest와 같은 방식.)
 */
class NoticeHtmlSanitizerTest {

    private final NoticeHtmlSanitizer sanitizer = new NoticeHtmlSanitizer();

    @Nested
    @DisplayName("화이트리스트 밖은 전부 제거된다")
    class Rejection {

        @Test
        @DisplayName("script 태그는 태그와 내용이 함께 사라진다")
        void scriptTag() {
            assertThat(sanitizer.sanitize("<script>alert(1)</script>")).isEmpty();
            assertThat(sanitizer.sanitize("<p>가글</p><script>alert(1)</script>")).isEqualTo("<p>가글</p>");
        }

        @Test
        @DisplayName("이벤트 핸들러 속성이 떨어진다")
        void eventHandlerAttributes() {
            assertThat(sanitizer.sanitize("<img src=\"/api/notices/attachments/1/content\" onerror=\"alert(1)\">"))
                    .doesNotContain("onerror")
                    .contains("src=");
        }

        @Test
        @DisplayName("javascript: 링크는 href째로 사라지고 내용만 남는다")
        void javascriptHref() {
            // allowStandardUrlProtocols()가 http/https/mailto 밖은 통째로 뺀다.
            assertThat(sanitizer.sanitize("<a href=\"javascript:alert(1)\">클릭</a>")).isEqualTo("클릭");
        }

        @Test
        @DisplayName("허용하지 않은 클래스 이름은 속성째로 빠진다")
        void unknownClass() {
            // 요소는 남고 class만 빠진다. onclick도 함께 사라진다.
            assertThat(sanitizer.sanitize("<p class=\"evil\" onclick=\"x()\">글</p>")).isEqualTo("<p>글</p>");
        }

        @Test
        @DisplayName("data-list는 허용된 값만 통과한다")
        void dataListAllowList() {
            assertThat(sanitizer.sanitize("<ul><li data-list=\"bullet\">항목</li></ul>"))
                    .contains("data-list=\"bullet\"");
            assertThat(sanitizer.sanitize("<li data-list=\"hacker\">값</li>")).doesNotContain("data-list");
        }

        @Test
        @DisplayName("style에서 expression()과 url()은 떨어지고 색만 남는다")
        void cssUrlAndExpressionDropped() {
            assertThat(sanitizer.sanitize("<p style=\"color: red; background-image: url(http://x/y.png)\">글</p>"))
                    .contains("color:red")
                    .doesNotContain("url(");
            assertThat(sanitizer.sanitize("<p style=\"width: expression(alert(1));\">글</p>")).isEqualTo("<p>글</p>");
        }
    }

    @Nested
    @DisplayName("본문 이미지 주소는 우리 첨부 엔드포인트만 통과시킨다")
    class ImageSrcAllowList {

        @Test
        @DisplayName("첨부 주소는 통과한다")
        void attachmentPathAllowed() {
            assertThat(sanitizer.sanitize("<img src=\"/api/notices/attachments/1/content\">"))
                    .contains("src=\"/api/notices/attachments/1/content\"");
        }

        @Test
        @DisplayName("base64 인라인 이미지는 DB 폭증을 막으므로 떨어진다")
        void dataUriRejected() {
            assertThat(sanitizer.sanitize("<img src=\"data:image/png;base64,AAAA\">")).isEmpty();
        }

        @Test
        @DisplayName("외부 도메인 이미지는 추적 픽셀이 되므로 떨어진다")
        void remoteImageRejected() {
            assertThat(sanitizer.sanitize("<img src=\"https://evil.example/pixel.png\">")).isEmpty();
        }

        @Test
        @DisplayName("javascript: 를 src에 넣어도 떨어진다")
        void javascriptSrcRejected() {
            assertThat(sanitizer.sanitize("<img src=\"javascript:alert(1)\">")).isEmpty();
        }

        @Test
        @DisplayName("숫자가 다른 자릿수라도 통과한다")
        void multiDigitIdAllowed() {
            assertThat(sanitizer.sanitize("<img src=\"/api/notices/attachments/12345678901/content\">"))
                    .contains("src=\"/api/notices/attachments/12345678901/content\"");
        }
    }

    @Nested
    @DisplayName("Quill이 만들어 낸 모양이 살아남아야 한다")
    class QuillRoundTrip {

        @Test
        @DisplayName("Quill 클래스만 통과한다")
        void quillClassesKept() {
            String html = sanitizer.sanitize(
                    "<p class=\"ql-indent-1\"><span class=\"ql-size-large\">크기</span></p>");
            assertThat(html).contains("ql-indent-1").contains("ql-size-large");
        }

        @Test
        @DisplayName("rgb()/rgba() 스타일이 살아남는다")
        void rgbColorSurvives() {
            // 여기서 rgb()/rgba()를 빼면 안 된다. 에디터는 색을 hex로 저장하지만
            // 브라우저가 innerHTML로 돌려줄 때 rgb(230, 0, 0) 형태로 정규화한다.
            // CssSchema는 속성과 함수를 따로 관리하므로, 함수 정의가 없으면 색을
            // 넣은 글의 스타일만 조용히 사라진다. 실패가 눈에 보이지 않는 규칙이라
            // 반드시 고정해 둔다.
            assertThat(sanitizer.sanitize("<p><span style=\"color: rgb(230, 0, 0);\">빨강</span></p>"))
                    .contains("rgb(")
                    .contains("빨강");
            assertThat(sanitizer.sanitize("<span style=\"background-color: rgba(1, 2, 3, 0.5);\">배경</span>"))
                    .contains("rgba(");
        }

        @Test
        @DisplayName("정렬 스타일이 살아남는다")
        void textAlignSurvives() {
            assertThat(sanitizer.sanitize("<p style=\"text-align: center;\">가운데</p>")).contains("text-align:center");
        }

        @Test
        @DisplayName("기본 서식 태그가 살아남는다")
        void basicFormattingTags() {
            String html = sanitizer.sanitize(
                    "<h2>제목</h2><p><strong>굵게</strong> <em>기울임</em> <u>밑줄</u></p>"
                            + "<ul><li>항목</li></ul><blockquote>인용</blockquote><hr>");
            assertThat(html).contains("<h2>").contains("<strong>").contains("<em>").contains("<u>")
                    .contains("<li>").contains("<blockquote>");
        }
    }

    @Nested
    @DisplayName("링크 보안은 서버가 책임진다")
    class LinkSecurity {

        @Test
        @DisplayName("target=_blank에는 rel=nofollow noopener noreferrer가 붙는다")
        void blankTargetGetsRel() {
            // requireRelNofollowOnLinks()가 저장 시점에 주입한다. opener를 남기면
            // 열린 페이지가 원래 탭을 조작할 수 있다.
            assertThat(sanitizer.sanitize("<a href=\"https://example.com\" target=\"_blank\">외부</a>"))
                    .contains("rel=\"nofollow noopener noreferrer\"");
        }

        @Test
        @DisplayName("클라이언트가 이미 rel을 넣었어도 서버 값이 이긴다")
        void serverRelWins() {
            assertThat(sanitizer.sanitize(
                    "<a href=\"https://example.com\" target=\"_blank\" rel=\"opener\">외부</a>"))
                    .doesNotContain("rel=\"opener\"")
                    .contains("noopener");
        }
    }

    @Nested
    @DisplayName("검색용 평문을 만든다")
    class PlainText {

        @Test
        @DisplayName("태그를 지우고 공백을 한 칸으로 접는다")
        void stripsAndCollapses() {
            assertThat(sanitizer.toPlainText("<p>Hello <b>World</b></p>")).isEqualTo("Hello World");
            assertThat(sanitizer.toPlainText("<p>a   b\n\n  c</p>")).isEqualTo("a b c");
        }

        @Test
        @DisplayName("앞뒤 공백을 자른다")
        void trims() {
            assertThat(sanitizer.toPlainText("  <p>  글  </p>  ")).isEqualTo("글");
        }

        @Test
        @DisplayName("엔티티를 한 번만 되돌린다")
        void singleDecodeOnly() {
            // &amp;를 마지막에 치환해야 이중 디코딩이 막는다. 순서가 틀어져
            // &amp;lt;가 < 로 풀리면, 사용자가 이스케이프한 문자열이 검색 로직에서
            // 마크업으로 다시 태어난다.
            assertThat(sanitizer.toPlainText("&lt;b&gt;")).isEqualTo("<b>");
            assertThat(sanitizer.toPlainText("&amp;lt;script&amp;gt;")).isEqualTo("&lt;script&gt;");
        }

        @Test
        @DisplayName("따옴표와 앰퍼샌드를 되돌린다")
        void quotesAndAmpersand() {
            assertThat(sanitizer.toPlainText("A &amp; B")).isEqualTo("A & B");
            assertThat(sanitizer.toPlainText("&quot;x&quot; &amp; &#39;y&#39; &#34;z&#34;"))
                    .isEqualTo("\"x\" & 'y' \"z\"");
        }

        @Test
        @DisplayName("NBSP를 보통 공백으로 낮춘다")
        void nbspBecomesOrdinarySpace() {
            // 이게 없으면 화면에서는 공백으로 보이는 자리를 사용자가 일반 공백으로
            // 쳐도 검색이 걸리지 않는다. Java의 \s와 String.trim()은 U+0020
            // 이하만 보기 때문에 그저 "공백을 접는다/자른다"로는 잡히지 않는다.
            assertThat(sanitizer.toPlainText("<p>Hello&nbsp;World</p>")).isEqualTo("Hello World");
        }

        @Test
        @DisplayName("앞뒤 NBSP도 잘린다")
        void nbspIsTrimmed() {
            assertThat(sanitizer.toPlainText("<p>&nbsp;글&nbsp;</p>")).isEqualTo("글");
        }

        @Test
        @DisplayName("전각 공백도 보통 공백으로 낮춘다")
        void ideographicSpace() {
            assertThat(sanitizer.toPlainText("<p>가\u3000나</p>")).isEqualTo("가 나");
        }

        @Test
        @DisplayName("태그만 있는 본문은 빈 문자열이 된다")
        void emptyContent() {
            assertThat(sanitizer.toPlainText("<p></p>")).isEmpty();
            assertThat(sanitizer.toPlainText(null)).isEmpty();
            assertThat(sanitizer.toPlainText("")).isEmpty();
        }

        @Test
        @DisplayName("한글 본문이 유지된다")
        void koreanSurvives() {
            assertThat(sanitizer.toPlainText("<p>안녕하세요 공지입니다</p>")).isEqualTo("안녕하세요 공지입니다");
        }
    }

    @Nested
    @DisplayName("경계값")
    class EdgeCases {

        @Test
        @DisplayName("null과 빈 문자열")
        void nullAndEmpty() {
            assertThat(sanitizer.sanitize(null)).isEmpty();
            assertThat(sanitizer.sanitize("")).isEmpty();
        }
    }
}