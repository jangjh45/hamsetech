package com.hamsetech.hamsetech.admin;

import com.hamsetech.hamsetech.user.UserAccount;
import com.hamsetech.hamsetech.user.UserAccountRepository;
import com.hamsetech.hamsetech.user.UserRole;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Set;

@Configuration
public class AdminInitializer {

    @Bean
    CommandLineRunner seedAdmin(@Value("${admin.username:admin}") String adminUsername,
                                @Value("${admin.email:admin@example.com}") String adminEmail,
                                @Value("${admin.password:admin1234}") String adminPassword,
                                @Value("${admin.display-name:관리자}") String adminDisplayName,
                                @Value("${admin.reset-password-on-start:true}") boolean resetPasswordOnStart,
                                UserAccountRepository userRepository,
                                PasswordEncoder passwordEncoder) {
        return args -> {
            var existing = userRepository.findByUsername(adminUsername).orElse(null);
            if (existing == null) {
                UserAccount admin = new UserAccount();
                admin.setUsername(adminUsername);
                admin.setEmail(adminEmail);
                admin.setPasswordHash(passwordEncoder.encode(adminPassword));
                admin.setDisplayName(adminDisplayName != null && !adminDisplayName.isBlank() ? adminDisplayName : adminUsername);
                admin.setRoles(Set.of(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.USER));
                userRepository.save(admin);
                System.out.println("[ADMIN INIT] default admin created: " + adminUsername);
            } else {
                // Ensure ADMIN role exists
                var roles = existing.getRoles();
                if (!roles.contains(UserRole.ADMIN)) {
                    roles.add(UserRole.ADMIN);
                    existing.setRoles(roles);
                    System.out.println("[ADMIN INIT] added ADMIN role to existing user: " + adminUsername);
                }
                if (!roles.contains(UserRole.SUPER_ADMIN)) {
                    roles.add(UserRole.SUPER_ADMIN);
                    existing.setRoles(roles);
                    System.out.println("[ADMIN INIT] added SUPER_ADMIN role to existing user: " + adminUsername);
                }
                // Optionally reset password from properties (dev convenience)
                if (resetPasswordOnStart) {
                    existing.setPasswordHash(passwordEncoder.encode(adminPassword));
                    System.out.println("[ADMIN INIT] reset admin password on start for user: " + adminUsername);
                }
                // Ensure email populated
                if (existing.getEmail() == null || existing.getEmail().isBlank()) {
                    existing.setEmail(adminEmail);
                }
                // Ensure display name populated
                if (existing.getDisplayName() == null || existing.getDisplayName().isBlank()) {
                    existing.setDisplayName(adminDisplayName != null && !adminDisplayName.isBlank() ? adminDisplayName : adminUsername);
                    System.out.println("[ADMIN INIT] set display name for admin: " + existing.getDisplayName());
                }
                userRepository.save(existing);
            }
        };
    }
}


