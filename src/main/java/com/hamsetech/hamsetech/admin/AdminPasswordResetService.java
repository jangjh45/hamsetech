package com.hamsetech.hamsetech.admin;

import com.hamsetech.hamsetech.security.SecurityUtils;
import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;

/**
 * 관리자에 의한 비밀번호 초기화.
 *
 * 예전에는 /api/auth/reset-by-identity가 아이디와 가입 이메일만 맞으면 인증 없이
 * 비밀번호를 바꿔 줬다. 이메일 소유를 확인하는 절차가 없어, 사번 기반 아이디와
 * 사내 이메일 규칙을 아는 사람이면 남의 계정을 가져갈 수 있었다.
 *
 * 메일 발송 인프라가 없는 사내 시스템이므로, 자가 재설정 대신 관리자가 임시
 * 비밀번호를 발급하고 본인에게 직접 전달하는 방식으로 대체한다.
 */
@Service
public class AdminPasswordResetService {

    /**
     * 임시 비밀번호에 쓸 문자.
     *
     * 관리자가 구두나 메신저로 옮겨 적는 값이라 혼동되는 글자(0/O, 1/l/I)를 뺐다.
     * 잘못 받아적으면 "비밀번호가 틀렸다"는 문의가 돌아오고, 그 사이 계정 잠금까지
     * 걸린다.
     */
    private static final String ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private static final int TEMP_PASSWORD_LENGTH = 12;

    private final SecureRandom random = new SecureRandom();

    private final UserAccountRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final SecurityUtils securityUtils;

    public AdminPasswordResetService(UserAccountRepository userRepository,
                                     PasswordEncoder passwordEncoder,
                                     SecurityUtils securityUtils) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.securityUtils = securityUtils;
    }

    /** 초기화가 허용되지 않는 대상일 때. 호출부가 400으로 바꾼다. */
    public static class ResetNotAllowedException extends RuntimeException {
        public ResetNotAllowedException(String message) {
            super(message);
        }
    }

    /**
     * 임시 비밀번호를 발급하고 대상 계정의 기존 토큰을 무효화한다.
     *
     * @return 평문 임시 비밀번호. 응답에 한 번 실어 보내는 것이 전부이고
     *         어디에도 저장하지 않는다.
     */
    @Transactional
    public String resetPassword(UserAccount target) {
        // 일반 ADMIN이 SUPER_ADMIN의 비밀번호를 초기화할 수 있으면, 그 자체가
        // 최고 권한을 가져가는 경로가 된다. SUPER_ADMIN은 SUPER_ADMIN만 건드린다.
        if (target.isSuperAdmin() && !securityUtils.isSuperAdmin()) {
            throw new ResetNotAllowedException("SUPER_ADMIN 계정의 비밀번호는 SUPER_ADMIN만 초기화할 수 있습니다.");
        }
        if (target.isWithdrawn()) {
            throw new ResetNotAllowedException("탈퇴 처리된 계정입니다.");
        }

        String tempPassword = generateTempPassword();
        target.setPasswordHash(passwordEncoder.encode(tempPassword));
        // 초기화의 목적이 대개 "계정을 되찾는 것"이다. 남이 쓰고 있던 세션이
        // 그대로 살아 있으면 초기화의 의미가 없다.
        target.bumpTokenVersion();
        userRepository.save(target);

        return tempPassword;
    }

    private String generateTempPassword() {
        StringBuilder sb = new StringBuilder(TEMP_PASSWORD_LENGTH);
        for (int i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
