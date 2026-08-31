package com.hamsetech.hamsetech.security;

import com.hamsetech.hamsetech.user.UserAccount;
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

    public String generateToken(UserAccount user) {
        Instant now = Instant.now();
        String roles = user.getRoles().stream().map(Enum::name).collect(Collectors.joining(","));
        return Jwts.builder()
                .subject(user.getUsername())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirationSeconds)))
                .claim("roles", roles)
                .signWith(secretKey)
                .compact();
    }

    /**
     * 서명 검증과 subject 추출을 한 번에 수행한다. 인증 필터는 요청마다 이 메서드만
     * 호출하므로, 토큰을 "검증 후 다시 파싱"하지 않는다.
     */
    public Optional<String> extractValidUsername(String token) {
        try {
            String username = Jwts.parser().verifyWith(secretKey).build()
                    .parseSignedClaims(token).getPayload().getSubject();
            return username == null || username.isBlank() ? Optional.empty() : Optional.of(username);
        } catch (Exception e) {
            return Optional.empty();
        }
    }
}


