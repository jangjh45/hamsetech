package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class JwtService {

    /** 토큰 세대 클레임. UserAccount.tokenVersion과 대조해 옛 토큰을 걸러낸다. */
    static final String TOKEN_VERSION_CLAIM = "tv";

    private final SecretKey secretKey;
    private final long expirationSeconds;

    public JwtService(JwtProperties properties) {
        String secret = properties.getSecret();
        if (secret == null || secret.length() < 32) {
            throw new IllegalStateException("security.jwt.secret must be at least 32 characters long");
        }
        long expirationSeconds = properties.getExpirationSeconds();
        if (expirationSeconds <= 0) {
            throw new IllegalStateException("security.jwt.expiration-seconds must be positive");
        }
        this.secretKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expirationSeconds = expirationSeconds;
    }

    /** 토큰에서 꺼낸, 서명이 검증된 값들. */
    public record TokenClaims(String username, int tokenVersion) {}

    public String generateToken(UserAccount user) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(user.getUsername())
                .claim("roles", user.getRoles().stream().map(Enum::name).collect(Collectors.toList()))
                .claim(TOKEN_VERSION_CLAIM, user.getTokenVersion())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirationSeconds)))
                .signWith(secretKey)
                .compact();
    }

    /**
     * 서명 검증과 클레임 추출을 한 번에 수행한다. 인증 필터는 요청마다 이 메서드만
     * 호출하므로, 토큰을 "검증 후 다시 파싱"하지 않는다.
     *
     * 서명 불일치·만료·형식 오류는 모두 빈 Optional로 수렴한다. 호출부가 사유별로
     * 다르게 반응할 이유가 없고, 사유를 밖으로 흘리면 공격자에게 힌트가 된다.
     */
    public Optional<TokenClaims> extractValidClaims(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(secretKey).build()
                    .parseSignedClaims(token).getPayload();
            String username = claims.getSubject();
            if (username == null || username.isBlank()) {
                return Optional.empty();
            }
            // tv 클레임이 없는 토큰은 이 기능 도입 이전에 발급된 것이다. 0으로 읽으면
            // 아직 비밀번호를 바꾼 적 없는 계정(tokenVersion=0)에 한해 계속 통한다.
            Integer version = claims.get(TOKEN_VERSION_CLAIM, Integer.class);
            return Optional.of(new TokenClaims(username, version == null ? 0 : version));
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}
