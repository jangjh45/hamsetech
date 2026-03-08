package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SecurityUtils {

    private final UserAccountRepository userAccountRepository;

    public SecurityUtils(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    public String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "anonymous";
    }

    public String currentUserDisplayName() {
        String username = currentUsername();
        return userAccountRepository.findByUsername(username)
                .map(u -> (u.getDisplayName() != null && !u.getDisplayName().isBlank())
                        ? u.getDisplayName()
                        : username)
                .orElse(username);
    }

    public boolean isAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            if ("ROLE_ADMIN".equals(ga.getAuthority()) || "ROLE_SUPER_ADMIN".equals(ga.getAuthority())) {
                return true;
            }
        }
        return false;
    }
}
