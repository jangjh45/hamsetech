package com.hamsetech.hamsetech.web;

import com.hamsetech.hamsetech.web.ApiExceptions.ConflictException;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 예외를 HTTP 응답으로 옮기는 유일한 자리.
 *
 * 원래 auth 패키지에 있던 ValidationExceptionHandler를 흡수했다. 전역에 걸리는
 * 핸들러가 특정 기능 패키지 안에 숨어 있으면, 다른 컨트롤러를 짜는 사람이 그
 * 존재를 모른다. 실제로 OvertimeRecordController에는 "여기엔 IllegalArgumentException
 * 핸들러가 없어 그대로 두면 500이 된다"는 주석과 함께 같은 처리를 하는 try/catch가
 * 있었다 — 사실은 이미 전역 핸들러가 있었다.
 *
 * 응답 본문은 {"error": 메시지} 하나로 통일한다. 권한 거부만 code=FORBIDDEN을
 * 더한다. client.ts가 code로 "권한 거부"와 "토큰 만료"를 구분하기 때문이다.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * 404는 본문 없이 돌려준다. 예전 ResponseEntity.notFound().build()와 같은 모양이라
     * 이 리팩터링으로 클라이언트가 보는 것이 달라지지 않는다.
     */
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<Void> handleNotFound(NotFoundException ex) {
        return ResponseEntity.notFound().build();
    }

    /**
     * code=FORBIDDEN을 빠뜨리면 client.ts가 이 응답을 토큰 만료로 읽고 멀쩡히
     * 로그인한 사용자를 로그아웃시킨다. SecurityConfig의 accessDeniedHandler도
     * 같은 모양으로 응답한다.
     */
    @ExceptionHandler(ForbiddenException.class)
    public ResponseEntity<Map<String, String>> handleForbidden(ForbiddenException ex) {
        Map<String, String> body = new LinkedHashMap<>();
        body.put("code", "FORBIDDEN");
        body.put("error", message(ex.getMessage(), "권한이 없습니다."));
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<Map<String, String>> handleConflict(ConflictException ex) {
        return error(HttpStatus.CONFLICT, message(ex.getMessage(), "지금은 처리할 수 없는 요청입니다."));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, String>> handleValidation(MethodArgumentNotValidException ex) {
        // 첫 번째 위반만 보여 준다. 화면이 한 번에 한 줄만 띄우기 때문이다.
        var fieldError = ex.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String message = fieldError != null && fieldError.getDefaultMessage() != null
                ? fieldError.getDefaultMessage()
                : "입력 값이 올바르지 않습니다.";
        return error(HttpStatus.BAD_REQUEST, message);
    }

    /**
     * 어노테이션만으로는 못 잡는 본문 검증(예: 공지 본문이 태그만 남고 글자가 없는 경우)에서
     * 던지는 예외. 그대로 두면 500이 나가 사용자에게 원인이 전달되지 않는다.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> handleIllegalArgument(IllegalArgumentException ex) {
        return error(HttpStatus.BAD_REQUEST, message(ex.getMessage(), "입력 값이 올바르지 않습니다."));
    }

    /** 유니크 제약 등 중복 위반. 원인 컬럼을 그대로 노출하지 않는다. */
    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, String>> handleDuplicate(DataIntegrityViolationException ex) {
        return error(HttpStatus.BAD_REQUEST, "이미 사용 중인 값이 있습니다. 다른 값을 입력해 주세요.");
    }

    private ResponseEntity<Map<String, String>> error(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message));
    }

    private String message(String message, String fallback) {
        return message == null || message.isBlank() ? fallback : message;
    }
}
