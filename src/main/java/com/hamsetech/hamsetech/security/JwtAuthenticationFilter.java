package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import org.springframework.lang.NonNull;
import java.util.stream.Collectors;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final UserAccountRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, UserAccountRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (StringUtils.hasText(authHeader) && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);
            jwtService.extractValidClaims(token).ifPresent(claims -> {
                var user = userRepository.findByUsername(claims.username()).orElse(null);
                if (user == null) {
                    return;
                }
                // 승인이 취소되거나 탈퇴 처리된 계정은 이미 발급된 토큰이 남아 있어도 통과시키지 않는다
                if (!user.canAccess()) {
                    return;
                }
                // 비밀번호 변경·초기화·탈퇴 확정 시점 이전에 발급된 토큰을 걸러낸다.
                // 계정 조회는 어차피 하고 있으므로 이 대조에 드는 추가 쿼리는 없다.
                if (claims.tokenVersion() != user.getTokenVersion()) {
                    return;
                }
                var authorities = user.getRoles().stream()
                        .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                        .collect(Collectors.toList());
                var auth = new UsernamePasswordAuthenticationToken(claims.username(), null, authorities);
                auth.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(auth);
            });
        }
        filterChain.doFilter(request, response);
    }
}


