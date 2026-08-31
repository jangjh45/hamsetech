package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Component;

/**
 * 현재 요청의 인증 주체를 읽는 단일 창구.
 *
 * 같은 판정을 여러 곳에서 각자 구현하면 한쪽만 고쳐지는 사고가 난다.
 * 권한 판정은 전부 여기를 거친다.
 */
@Component
public class SecurityUtils {

    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";

    /** 인증 정보가 없을 때 감사 로그에 남길 이름. */
    public static final String ANONYMOUS = "anonymous";

    private final UserAccountRepository userAccountRepository;

    public SecurityUtils(UserAccountRepository userAccountRepository) {
        this.userAccountRepository = userAccountRepository;
    }

    /**
     * 현재 사용자명. 인증되지 않았으면 "anonymous".
     *
     * 감사 로그처럼 "누구든 기록은 남겨야 하는" 자리에 쓴다. 사용자가 만든 데이터에
     * 작성자로 박을 값이 필요하면 currentUsernameOrThrow를 쓴다.
     */
    public String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : ANONYMOUS;
    }

    /**
     * 인증된 사용자명. 인증되지 않았으면 예외.
     *
     * currentUsername()의 "anonymous" 폴백이 authorUsername이나 record.username 같은
     * 소유자 필드에 그대로 저장되면, 나중에 누구의 것인지 알 수 없는 행이 남는다.
     * 실제로는 @PreAuthorize가 앞에서 막지만 방어를 한 겹 더 둔다.
     */
    public String currentUsernameOrThrow() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            throw new UsernameNotFoundException("인증 정보가 없습니다.");
        }
        return auth.getName();
    }

    /**
     * 현재 로그인한 계정. 인증이 없거나 계정이 사라졌으면 예외.
     *
     * TodoController·UserController·PackingScenarioController가 각자
     * getCurrentUser(Authentication)를 두고 같은 조회를 반복하고 있었다. 셋의 실패
     * 동작이 제각각(RuntimeException, 401 응답)이라 같은 상황에서 다른 응답이 나갔다.
     */
    public UserAccount currentUser() {
        String username = currentUsernameOrThrow();
        return userAccountRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("사용자를 찾을 수 없습니다."));
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
        return hasAnyAuthority(ROLE_ADMIN, ROLE_SUPER_ADMIN);
    }

    public boolean isSuperAdmin() {
        return hasAnyAuthority(ROLE_SUPER_ADMIN);
    }

    private boolean hasAnyAuthority(String... wanted) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        for (GrantedAuthority ga : auth.getAuthorities()) {
            for (String w : wanted) {
                if (w.equals(ga.getAuthority())) {
                    return true;
                }
            }
        }
        return false;
    }
}
