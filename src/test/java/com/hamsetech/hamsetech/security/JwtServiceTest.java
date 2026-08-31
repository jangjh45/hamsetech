package com.hamsetech.hamsetech.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

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
        JwtProperties properties = new JwtProperties();
        properties.setSecret("test-only-secret-that-is-long-enough-for-hmac-sha");
        properties.setExpirationSeconds(0);

        assertThatThrownBy(() -> new JwtService(properties))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("must be positive");
    }

    @Test
    void rejectsMalformedTokensWithoutThrowingFromTheAuthenticationPath() {
        JwtProperties properties = new JwtProperties();
        properties.setSecret("test-only-secret-that-is-long-enough-for-hmac-sha");
        JwtService service = new JwtService(properties);

        assertThat(service.extractValidUsername("not-a-jwt")).isEmpty();
    }
}
