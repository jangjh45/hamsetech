package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccountRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.stream.Collectors;

/**
 * Revalidates the current session against the user record on each request.
 *
 * This preserves the immediate account-status and role updates that the old JWT
 * filter provided. It also compares the session's auth version with the current
 * value, so password resets invalidate sessions on every browser/device.
 */
@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    private final UserAccountRepository userRepository;

    public SessionAuthenticationFilter(UserAccountRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return "/api/auth/login".equals(path)
                || "/api/auth/register".equals(path)
                || "/api/auth/csrf".equals(path)
                || "/api/auth/logout".equals(path);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null
                || !authentication.isAuthenticated()
                || authentication instanceof AnonymousAuthenticationToken
                || !(authentication.getPrincipal() instanceof SessionPrincipal principal)) {
            filterChain.doFilter(request, response);
            return;
        }

        var user = userRepository.findByUsername(principal.username()).orElse(null);
        if (user == null || !user.canAccess() || principal.authVersion() != user.getAuthVersion()) {
            var session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            SecurityContextHolder.clearContext();
            filterChain.doFilter(request, response);
            return;
        }

        var authorities = user.getRoles().stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.name()))
                .collect(Collectors.toList());
        var refreshed = new UsernamePasswordAuthenticationToken(principal, null, authorities);
        refreshed.setDetails(authentication.getDetails() != null
                ? authentication.getDetails()
                : new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(refreshed);

        filterChain.doFilter(request, response);
    }
}
