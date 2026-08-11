package com.hamsetech.hamsetech.config;

import com.hamsetech.hamsetech.security.JwtAuthenticationFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

// @EnableMethodSecurity가 없으면 @PreAuthorize는 파싱조차 되지 않고 조용히 무시된다.
// 이 어노테이션이 빠져 있던 동안 컨트롤러의 @PreAuthorize가 전부 무효였고,
// 관리자 전용으로 표시된 엔드포인트를 일반 사용자가 그대로 호출할 수 있었다.
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                // 사내 업무 시스템이라 공지 본문·작성자 실명·사내 일정이 모두 내부 정보다.
                // 인증/오류/헬스체크만 열고 나머지는 전부 로그인 뒤로 둔다.
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/**", "/error", "/actuator/health").permitAll()
                        .requestMatchers("/api/admin/**").hasAnyRole("ADMIN","SUPER_ADMIN")
                        // 공지 쓰기는 관리자만. 컨트롤러의 @PreAuthorize와 중복이지만,
                        // 메서드 시큐리티가 다시 꺼지더라도 이 규칙은 살아남는다.
                        // "/api/notices/*"는 한 세그먼트만 매치하므로
                        // DELETE /api/notices/{id}/comments/{id}(일반 사용자 허용)는 걸리지 않는다.
                        .requestMatchers(HttpMethod.POST,   "/api/notices").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.POST,   "/api/notices/attachments").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/notices/attachments/*").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PUT,    "/api/notices/*").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/notices/*").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .requestMatchers(HttpMethod.PATCH,  "/api/notices/*/pin").hasAnyRole("ADMIN","SUPER_ADMIN")
                        .anyRequest().authenticated()
                )
                // 인증 없는 요청에는 401을 준다. 기본 동작은 익명 요청에 403을 주는데,
                // 그러면 클라이언트가 "토큰 만료"와 "권한 거부"를 상태 코드로 구분할 수 없다.
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED))
                        // 로그인은 됐지만 권한이 없는 경우. 기본 처리는 본문 없는 403이라
                        // client.ts가 이를 토큰 만료로 오인해 정상 사용자를 로그아웃시킨다.
                        // code=FORBIDDEN을 실어 "권한 거부"임을 명시한다.
                        .accessDeniedHandler((request, response, ex) -> {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.setContentType("application/json;charset=UTF-8");
                            response.getWriter().write(
                                    "{\"code\":\"FORBIDDEN\",\"error\":\"권한이 없습니다.\"}");
                        }));

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}


