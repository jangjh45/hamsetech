package com.hamsetech.hamsetech.security;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "security.login")
public class LoginProperties {

    /** 이 횟수만큼 연속 실패하면 잠근다. */
    private int maxAttempts = 5;

    /** 잠금 지속 시간(분). 이 시간이 지나면 자동으로 풀린다. */
    private int lockoutMinutes = 15;

    public int getMaxAttempts() {
        return maxAttempts;
    }

    public void setMaxAttempts(int maxAttempts) {
        this.maxAttempts = maxAttempts;
    }

    public int getLockoutMinutes() {
        return lockoutMinutes;
    }

    public void setLockoutMinutes(int lockoutMinutes) {
        this.lockoutMinutes = lockoutMinutes;
    }
}
