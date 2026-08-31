package com.hamsetech.hamsetech.web;

import com.hamsetech.hamsetech.config.SecurityConfig;
import com.hamsetech.hamsetech.security.JwtAuthenticationFilter;
import com.hamsetech.hamsetech.security.JwtService;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.web.ApiExceptions.ConflictException;
import com.hamsetech.hamsetech.web.ApiExceptions.ForbiddenException;
import com.hamsetech.hamsetech.web.ApiExceptions.NotFoundException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 오류 응답의 모양.
 *
 * 이건 취향 문제가 아니라 계약이다. client.ts는 403 본문에 code=FORBIDDEN이 있는지로
 * "권한 거부"와 "토큰 만료"를 가른다. code가 없으면 토큰을 지우고 사용자를
 * 로그아웃시킨다.
 *
 * 실제로 잔업 수정·삭제는 {"error":"forbidden"}을, 시나리오는 빈 본문을 돌려주고
 * 있었다. 남의 항목을 건드린 사용자가 "권한이 없습니다" 대신 로그아웃당했다는 뜻이다.
 * 여기서 그 모양을 고정해 다시 어긋나지 않게 한다.
 */
@WebMvcTest(controllers = ErrorResponseContractTest.ThrowingController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class,
        ErrorResponseContractTest.ThrowingController.class})
@ActiveProfiles("test")
class ErrorResponseContractTest {

    /** 각 예외를 던지기만 하는 테스트 전용 컨트롤러. */
    @RestController
    static class ThrowingController {

        @GetMapping("/test-errors/not-found")
        public String notFound() {
            throw new NotFoundException("없습니다.");
        }

        @GetMapping("/test-errors/forbidden")
        public String forbidden() {
            throw new ForbiddenException("본인의 기록만 처리할 수 있습니다.");
        }

        @GetMapping("/test-errors/conflict")
        public String conflict() {
            throw new ConflictException("이미 처리된 기록입니다");
        }

        @GetMapping("/test-errors/illegal-argument")
        public String illegalArgument() {
            throw new IllegalArgumentException("시작일이 종료일보다 늦을 수 없습니다");
        }

        @GetMapping("/test-errors/duplicate")
        public String duplicate() {
            throw new DataIntegrityViolationException("uk_users_email");
        }
    }

    @Autowired
    private MockMvc mvc;

    @MockitoBean private UserAccountRepository userAccountRepository;
    @MockitoBean private JwtService jwtService;

    @Test
    @WithMockUser
    @DisplayName("권한 거부 403에는 반드시 code=FORBIDDEN이 실린다")
    void forbiddenCarriesCode() throws Exception {
        // 이 필드가 빠지면 client.ts가 정상 사용자를 로그아웃시킨다.
        mvc.perform(get("/test-errors/forbidden"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.error").value("본인의 기록만 처리할 수 있습니다."));
    }

    @Test
    @WithMockUser
    @DisplayName("404는 본문 없이 나간다")
    void notFoundHasEmptyBody() throws Exception {
        // 리팩터링 전 ResponseEntity.notFound().build()와 같은 모양을 유지한다.
        mvc.perform(get("/test-errors/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(content().string(""));
    }

    @Test
    @WithMockUser
    @DisplayName("409는 메시지를 그대로 전달한다")
    void conflictCarriesMessage() throws Exception {
        mvc.perform(get("/test-errors/conflict"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("이미 처리된 기록입니다"));
    }

    @Test
    @WithMockUser
    @DisplayName("IllegalArgumentException은 400으로 바뀐다")
    void illegalArgumentBecomes400() throws Exception {
        // 엑셀 내보내기의 기간 검증이 이 경로를 탄다. 예전에는 컨트롤러마다
        // try/catch로 직접 처리하거나, 빠뜨리면 500이 나갔다.
        mvc.perform(get("/test-errors/illegal-argument"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("시작일이 종료일보다 늦을 수 없습니다"));
    }

    @Test
    @WithMockUser
    @DisplayName("중복 위반은 제약 이름을 노출하지 않는다")
    void duplicateDoesNotLeakConstraintName() throws Exception {
        mvc.perform(get("/test-errors/duplicate"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("이미 사용 중인 값이 있습니다. 다른 값을 입력해 주세요."));
    }
}
