package com.hamsetech.hamsetech.config;

import com.hamsetech.hamsetech.security.SessionAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import jakarta.servlet.http.HttpServletResponse;

// @EnableMethodSecurity가 없으면 @PreAuthorize는 파싱조차 되지 않고 조용히 무시된다.
// 이 어노테이션이 빠져 있던 동안 컨트롤러의 @PreAuthorize가 전부 무효였고,
// 관리자 전용으로 표시된 엔드포인트를 일반 사용자가 그대로 호출할 수 있었다.
//
// @EnableWebSecurity는 이 설정이 스스로 완결되게 하는 선언이다. Spring Security 공식
// Java Configuration 예제가 이 두 어노테이션을 함께 쓰는 이유다. 이 어노테이션이
// HttpSecurityConfiguration 과 AuthenticationConfiguration 을 등록한다.
//
// Boot 3.5까지는 Boot 가 이 둘을 대신 등록해 줬다(SpringBootWebSecurityConfiguration의
// WebSecurityEnablerConfiguration 이 @ConditionalOnClass(EnableWebSecurity)만 보고
// 적용됐다). Boot 4에서는 그 등록이 @ConditionalOnDefaultWebSecurity 뒤로 옮겨 갔다.
// SecurityFilterChain 빈을 직접 만드는 이 프로젝트처럼 "기본 설정"이 아닌 경우
// Boot 가 등록을 포기하면서 HttpSecurity 빈도 함께 사라진다. 그러면
// securityFilterChain(HttpSecurity http) 가 "No qualifying bean of type
// HttpSecurity" 로 컨텍스트 로딩을 깨뜨린다. @WebMvcTest 같은 슬라이스에서 특히
// 그런데, 거기서는 Boot의 서블릿 보안 자동설정이 아예 가져오기 목록에 없다.
//
// 우리가 직접 선언하면 Boot 가 뒤로 빠지더라도(그래서 기본 체인이 중복으로
// 생기지는 않는다) 우리 설정은 그대로 동작한다.
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@Import(SessionSecurityBeansConfiguration.class)
public class SecurityConfig {

    private final SessionAuthenticationFilter sessionAuthenticationFilter;
    private final SecurityContextRepository securityContextRepository;
    private final CsrfTokenRepository csrfTokenRepository;

    public SecurityConfig(SessionAuthenticationFilter sessionAuthenticationFilter,
                          SecurityContextRepository securityContextRepository,
                          CsrfTokenRepository csrfTokenRepository) {
        this.sessionAuthenticationFilter = sessionAuthenticationFilter;
        this.securityContextRepository = securityContextRepository;
        this.csrfTokenRepository = csrfTokenRepository;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf
                        .csrfTokenRepository(csrfTokenRepository))
                .cors(cors -> {})
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
                        .sessionFixation(fixation -> fixation.changeSessionId()))
                .logout(logout -> logout
                        .logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true)
                        .clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) ->
                                response.setStatus(HttpServletResponse.SC_NO_CONTENT)))
                // 사내 업무 시스템이라 공지 본문·작성자 실명·사내 일정이 모두 내부 정보다.
                // 인증/오류/헬스체크만 열고 나머지는 전부 로그인 뒤로 둔다.
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/error", "/actuator/health").permitAll()
                        // 아바타 URL은 UUID 난수 키로만 찾을 수 있고 이미지 바이트만 반환한다.
                        .requestMatchers(HttpMethod.GET, "/api/users/avatars/*").permitAll()
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN","SUPER_ADMIN")
                        // 공지 쓰기는 관리자만. 컨트롤러의 @PreAuthorize와 중복이지만,
                        // 메서드 시큐리티가 다시 꺼지더라도 이 규칙은 살아남는다.
                        // "/api/notices/*"는 한 세그먼트만 매치하므로
                        // 댓글 수정/삭제 경로는 걸리지 않고, 서비스가 작성자/관리자 권한을 검사한다.
                        .requestMatchers(HttpMethod.POST,   "/api/notices").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST,   "/api/notices/attachments").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/notices/attachments/*").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT,    "/api/notices/*").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/notices/*").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PATCH,  "/api/notices/*/pin").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .anyRequest().authenticated()
                )
                // 인증 없는 요청에는 401을 준다.
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        .accessDeniedHandler((request, response, ex) -> {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.setContentType("application/json;charset=UTF-8");
                            if (ex instanceof CsrfException) {
                                response.getWriter().write(
                                        "{\"code\":\"CSRF_INVALID\",\"error\":\"요청 토큰이 만료되었습니다. 다시 시도해 주세요.\"}");
                            } else {
                                response.getWriter().write(
                                        "{\"code\":\"FORBIDDEN\",\"error\":\"권한이 없습니다.\"}");
                            }
                        }));

        http.addFilterAfter(sessionAuthenticationFilter, CsrfFilter.class);

        return http.build();
    }
}


