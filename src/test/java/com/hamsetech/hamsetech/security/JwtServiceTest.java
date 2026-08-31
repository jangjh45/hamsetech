package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserRole;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "test-only-secret-that-is-long-enough-for-hmac-sha";

    private JwtService service() {
        return new JwtService(properties(SECRET));
    }

    private JwtProperties properties(String secret) {
        JwtProperties properties = new JwtProperties();
        properties.setSecret(secret);
        return properties;
    }

    private UserAccount user(String username, int tokenVersion) {
        UserAccount user = new UserAccount();
        user.setUsername(username);
        user.setRoles(Set.of(UserRole.USER));
        for (int i = 0; i < tokenVersion; i++) {
            user.bumpTokenVersion();
        }
        return user;
    }

    @Test
    void rejectsAnUnsafeSigningKeyAtStartup() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("too-short");

        assertThatThrownBy(() -> new JwtService(properties))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("at least 32");
    }

    @Test
    void rejectsNonPositiveTokenLifetime() {
        JwtProperties properties = properties(SECRET);
        properties.setExpirationSeconds(0);

        assertThatThrownBy(() -> new JwtService(properties))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be positive");
    }

    @Test
    void rejectsMalformedTokensWithoutThrowingFromTheAuthenticationPath() {
        assertThat(service().extractValidClaims("not-a-jwt")).isEmpty();
    }

    @Test
    @DisplayName("발급한 토큰에서 사용자명과 토큰 세대를 그대로 되읽는다")
    void roundTripsUsernameAndTokenVersion() {
        JwtService service = service();

        String token = service.generateToken(user("kim", 3));

        assertThat(service.extractValidClaims(token))
                .get()
                .satisfies(claims -> {
                    assertThat(claims.username()).isEqualTo("kim");
                    assertThat(claims.tokenVersion()).isEqualTo(3);
                });
    }

    @Test
    @DisplayName("tv 클레임이 없는 옛 토큰은 세대 0으로 읽는다")
    void treatsMissingTokenVersionClaimAsZero() {
        // 이 기능 도입 이전에 발급된 토큰. 아직 비밀번호를 바꾼 적 없는 계정에서만 통해야 한다.
        String legacyToken = Jwts.builder()
                .subject("kim")
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(service().extractValidClaims(legacyToken))
                .get()
                .satisfies(claims -> assertThat(claims.tokenVersion()).isZero());
    }

    @Test
    @DisplayName("만료된 토큰은 거부한다")
    void rejectsExpiredTokens() {
        Instant past = Instant.now().minusSeconds(3600);
        String expired = Jwts.builder()
                .subject("kim")
                .issuedAt(Date.from(past))
                .expiration(Date.from(past.plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(service().extractValidClaims(expired)).isEmpty();
    }

    @Test
    @DisplayName("다른 키로 서명된 토큰은 거부한다")
    void rejectsTokensSignedWithAnotherKey() {
        JwtService other = new JwtService(properties("a-completely-different-secret-of-sufficient-length"));
        String foreignToken = other.generateToken(user("kim", 0));

        assertThat(service().extractValidClaims(foreignToken)).isEmpty();
    }

    @Test
    @DisplayName("subject가 비어 있는 토큰은 거부한다")
    void rejectsTokensWithoutSubject() {
        String noSubject = Jwts.builder()
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(60)))
                .signWith(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();

        assertThat(service().extractValidClaims(noSubject)).isEmpty();
    }
}
