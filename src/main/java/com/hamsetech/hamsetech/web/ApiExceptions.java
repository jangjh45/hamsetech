package com.hamsetech.hamsetech.web;

/**
 * 서비스가 실패를 알리는 방법.
 *
 * 예전에는 서비스가 ResponseEntity를 직접 만들어 돌려줬다. 도메인 로직이 HTTP
 * 상태 코드와 응답 본문을 알아야 했고, 그래서 같은 "권한 없음"이 곳마다 다른
 * 모양으로 나갔다 — 공지는 {code, error}, 잔업은 {error:"forbidden"},
 * 시나리오는 본문 없음. 프론트(client.ts)는 code가 없는 403을 토큰 만료로 보고
 * 자동 로그아웃하므로, 뒤의 둘은 권한 거부가 로그아웃으로 둔갑했다.
 *
 * 서비스는 이제 이 예외들만 던지고, HTTP로 옮기는 일은 GlobalExceptionHandler가
 * 한곳에서 맡는다.
 */
public final class ApiExceptions {

    private ApiExceptions() {
    }

    /** 대상이 없다 → 404. */
    public static class NotFoundException extends RuntimeException {
        public NotFoundException(String message) {
            super(message);
        }
    }

    /** 로그인은 됐지만 이 리소스에 대한 권한이 없다 → 403 (+ code=FORBIDDEN). */
    public static class ForbiddenException extends RuntimeException {
        public ForbiddenException(String message) {
            super(message);
        }
    }

    /** 지금 상태에서는 할 수 없는 요청이다(이미 처리됨, 승인된 기록 삭제 등) → 409. */
    public static class ConflictException extends RuntimeException {
        public ConflictException(String message) {
            super(message);
        }
    }
}
