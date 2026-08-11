package com.hamsetech.hamsetech.auth;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class ValidationExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> handleValidation(MethodArgumentNotValidException ex) {
        var fieldError = ex.getBindingResult().getFieldErrors().stream().findFirst().orElse(null);
        String message = "입력 값이 올바르지 않습니다.";
        if (fieldError != null && fieldError.getDefaultMessage() != null) {
            message = fieldError.getDefaultMessage();
        }
        Map<String, String> body = new HashMap<>();
        body.put("error", message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    /**
     * 어노테이션만으로는 못 잡는 본문 검증(예: 공지 본문이 태그만 남고 글자가 없는 경우)에서
     * 던지는 예외. 그대로 두면 500이 나가 사용자에게 원인이 전달되지 않는다.
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<?> handleIllegalArgument(IllegalArgumentException ex) {
        Map<String, String> body = new HashMap<>();
        body.put("error", ex.getMessage() != null ? ex.getMessage() : "입력 값이 올바르지 않습니다.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> handleDup(DataIntegrityViolationException ex) {
        // 유니크 제약 등 중복 위반 시 사용자 친화 메시지 반환
        Map<String, String> body = new HashMap<>();
        body.put("error", "이미 사용 중인 값이 있습니다. 다른 값을 입력해 주세요.");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }
}


