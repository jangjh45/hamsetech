package com.hamsetech.hamsetech.security;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 로그인 시도 횟수 제한.
 *
 * /api/auth/login은 인증 없이 호출할 수 있고 시도 횟수 제한이 없었다. 비밀번호를
 * 무제한으로 추측할 수 있다는 것 자체도 문제지만, 실패할 때마다 감사 로그가 한 줄씩
 * 쌓이므로 로그 테이블을 부풀리는 경로이기도 했다. 여기서 둘 다 막는다.
 *
 * 저장소는 인메모리다. Redis는 아직 구성되지 않았고(application.yml의 헬스체크 제외
 * 주석 참고), 배포도 단일 인스턴스라 지금은 이걸로 충분하다. 여러 인스턴스로
 * 늘어나는 시점에는 공유 저장소로 옮겨야 한다.
 *
 * 시간은 Clock으로 주입받는다. Instant.now()를 직접 부르면 "잠금이 시간이 지나면
 * 풀린다"를 테스트할 방법이 없어진다.
 */
@Service
public class LoginAttemptService {

    private final Clock clock;
    private final int maxAttempts;
    private final Duration lockout;

    /** username(소문자) -> 연속 실패 기록 */
    private final Map<String, Attempts> attempts = new ConcurrentHashMap<>();

    private record Attempts(int count, Instant lastFailureAt) {}

    public LoginAttemptService(LoginProperties properties, Clock clock) {
        this.clock = clock;
        this.maxAttempts = properties.getMaxAttempts();
        this.lockout = Duration.ofMinutes(properties.getLockoutMinutes());
    }

    /**
     * 지금 이 계정이 잠겨 있는지.
     *
     * 마지막 실패로부터 잠금 시간이 지났으면 기록을 지우고 통과시킨다. 별도의
     * 해제 작업 없이 만료가 알아서 이뤄진다.
     */
    public boolean isLocked(String username) {
        String key = key(username);
        Attempts current = attempts.get(key);
        if (current == null) {
            return false;
        }
        if (isExpired(current)) {
            attempts.remove(key, current);
            return false;
        }
        return current.count() >= maxAttempts;
    }

    /**
     * 실패를 한 건 기록한다.
     *
     * @return 이 실패로 계정이 막 잠겼으면 true. 이미 잠겨 있었다면 false다.
     *         호출부는 이 값이 true일 때만 감사 로그를 남겨, 잠긴 뒤로도 계속
     *         들어오는 시도가 로그 테이블을 채우지 않게 한다.
     */
    public boolean recordFailure(String username) {
        String key = key(username);
        Instant now = clock.instant();
        Attempts updated = attempts.compute(key, (k, current) -> {
            if (current == null || isExpired(current)) {
                return new Attempts(1, now);
            }
            return new Attempts(current.count() + 1, now);
        });
        return updated.count() == maxAttempts;
    }

    /** 로그인에 성공하면 카운터를 지운다. 연속 실패만 잠금 대상이다. */
    public void recordSuccess(String username) {
        attempts.remove(key(username));
    }

    /** 남은 잠금 시간(분). 사용자에게 안내할 값이라 올림한다. */
    public long lockoutMinutesRemaining(String username) {
        Attempts current = attempts.get(key(username));
        if (current == null || isExpired(current)) {
            return 0;
        }
        Duration remaining = lockout.minus(Duration.between(current.lastFailureAt(), clock.instant()));
        return Math.max(1, (remaining.toSeconds() + 59) / 60);
    }

    /**
     * 만료된 기록을 치운다. 없어도 동작에는 지장이 없지만(조회 시점에 만료를
     * 확인한다), 다시 시도하지 않는 계정의 기록이 영영 남아 메모리를 잡는다.
     */
    @Scheduled(fixedDelayString = "PT1H")
    public void purgeExpired() {
        attempts.values().removeIf(this::isExpired);
    }

    private boolean isExpired(Attempts a) {
        return Duration.between(a.lastFailureAt(), clock.instant()).compareTo(lockout) >= 0;
    }

    /** 아이디 대소문자를 다르게 써서 카운터를 우회하지 못하게 한다. */
    private String key(String username) {
        return username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
    }
}
