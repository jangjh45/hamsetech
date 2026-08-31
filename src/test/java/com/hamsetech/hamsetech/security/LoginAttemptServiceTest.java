package com.hamsetech.hamsetech.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 로그인 시도 제한.
 *
 * 시간을 앞으로 돌려야 "잠금이 저절로 풀린다"를 확인할 수 있으므로 Clock을 직접 넘긴다.
 */
class LoginAttemptServiceTest {

    private static final Instant T0 = Instant.parse("2026-08-31T09:00:00Z");

    /** 테스트가 임의로 앞으로 돌릴 수 있는 시계. */
    private static class MovableClock extends Clock {
        private Instant now = T0;

        @Override public ZoneOffset getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(java.time.ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }

        void advance(Duration d) { now = now.plus(d); }
    }

    private final MovableClock clock = new MovableClock();

    private LoginAttemptService service(int maxAttempts, int lockoutMinutes) {
        LoginProperties properties = new LoginProperties();
        properties.setMaxAttempts(maxAttempts);
        properties.setLockoutMinutes(lockoutMinutes);
        return new LoginAttemptService(properties, clock);
    }

    @Test
    @DisplayName("임계치 직전까지는 잠기지 않는다")
    void doesNotLockBelowThreshold() {
        LoginAttemptService service = service(5, 15);

        for (int i = 0; i < 4; i++) {
            assertThat(service.recordFailure("kim")).isFalse();
        }

        assertThat(service.isLocked("kim")).isFalse();
    }

    @Test
    @DisplayName("임계치에 닿으면 잠기고, 그 순간에만 true를 돌려준다")
    void locksAtThresholdAndSignalsOnce() {
        LoginAttemptService service = service(5, 15);

        for (int i = 0; i < 4; i++) {
            service.recordFailure("kim");
        }

        // 감사 로그는 이 true 한 번에만 남는다. 이후 시도는 로그를 더 만들지 않는다.
        assertThat(service.recordFailure("kim")).isTrue();
        assertThat(service.isLocked("kim")).isTrue();
        assertThat(service.recordFailure("kim")).isFalse();
    }

    @Test
    @DisplayName("잠금은 한 계정에만 걸린다")
    void lockIsPerAccount() {
        LoginAttemptService service = service(3, 15);

        for (int i = 0; i < 3; i++) {
            service.recordFailure("kim");
        }

        assertThat(service.isLocked("kim")).isTrue();
        assertThat(service.isLocked("lee")).isFalse();
    }

    @Test
    @DisplayName("대소문자를 바꿔도 같은 계정으로 센다")
    void countsCaseInsensitively() {
        LoginAttemptService service = service(3, 15);

        service.recordFailure("kim");
        service.recordFailure("KIM");
        service.recordFailure("Kim");

        assertThat(service.isLocked("kim")).isTrue();
    }

    @Test
    @DisplayName("로그인에 성공하면 카운터가 지워진다")
    void successResetsCounter() {
        LoginAttemptService service = service(3, 15);

        service.recordFailure("kim");
        service.recordFailure("kim");
        service.recordSuccess("kim");

        // 초기화되지 않았다면 이 한 번으로 잠겼을 것이다
        assertThat(service.recordFailure("kim")).isFalse();
        assertThat(service.isLocked("kim")).isFalse();
    }

    @Test
    @DisplayName("잠금 시간이 지나면 저절로 풀린다")
    void lockExpires() {
        LoginAttemptService service = service(3, 15);
        for (int i = 0; i < 3; i++) {
            service.recordFailure("kim");
        }
        assertThat(service.isLocked("kim")).isTrue();

        clock.advance(Duration.ofMinutes(15));

        assertThat(service.isLocked("kim")).isFalse();
    }

    @Test
    @DisplayName("잠금 시간 안에 다시 실패하면 잠금이 유지된다")
    void staysLockedWithinWindow() {
        LoginAttemptService service = service(3, 15);
        for (int i = 0; i < 3; i++) {
            service.recordFailure("kim");
        }

        clock.advance(Duration.ofMinutes(14));

        assertThat(service.isLocked("kim")).isTrue();
    }

    @Test
    @DisplayName("연속이 끊기면(만료 후 실패) 카운터가 1부터 다시 센다")
    void countsRestartAfterExpiry() {
        LoginAttemptService service = service(3, 15);
        for (int i = 0; i < 3; i++) {
            service.recordFailure("kim");
        }

        clock.advance(Duration.ofMinutes(20));
        assertThat(service.recordFailure("kim")).isFalse();
        assertThat(service.isLocked("kim")).isFalse();
    }

    @Test
    @DisplayName("남은 잠금 시간은 올림해서 알려준다")
    void reportsRemainingMinutes() {
        LoginAttemptService service = service(3, 15);
        for (int i = 0; i < 3; i++) {
            service.recordFailure("kim");
        }

        clock.advance(Duration.ofMinutes(10));

        // 5분 남았다. 사용자에게 "0분 후" 같은 안내가 나가지 않게 최소 1을 보장한다.
        assertThat(service.lockoutMinutesRemaining("kim")).isEqualTo(5);
    }

    @Test
    @DisplayName("잠기지 않은 계정의 남은 시간은 0이다")
    void remainingIsZeroWhenNotLocked() {
        assertThat(service(3, 15).lockoutMinutesRemaining("kim")).isZero();
    }

    @Test
    @DisplayName("만료된 기록은 정리 작업이 치운다")
    void purgeRemovesExpiredEntries() {
        LoginAttemptService service = service(3, 15);
        for (int i = 0; i < 3; i++) {
            service.recordFailure("kim");
        }

        clock.advance(Duration.ofMinutes(20));
        service.purgeExpired();

        assertThat(service.isLocked("kim")).isFalse();
        assertThat(service.lockoutMinutesRemaining("kim")).isZero();
    }
}
