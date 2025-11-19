package com.hamsetech.hamsetech.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "admin")
public class AdminProperties {
    private String username = "admin";
    private String email = "admin@example.com";
    private String password = "admin1234";
    private String displayName = "관리자";
    private boolean resetPasswordOnStart = true;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public boolean isResetPasswordOnStart() {
        return resetPasswordOnStart;
    }

    public void setResetPasswordOnStart(boolean resetPasswordOnStart) {
        this.resetPasswordOnStart = resetPasswordOnStart;
    }
}

