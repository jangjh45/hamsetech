package com.hamsetech.hamsetech.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long>,
        JpaSpecificationExecutor<UserAccount> {
    Optional<UserAccount> findByUsername(String username);
    List<UserAccount> findByUsernameIn(Collection<String> usernames);
    Optional<UserAccount> findByEmail(String email);
    Optional<UserAccount> findByAvatarKey(String avatarKey);
    boolean existsByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByEmailIgnoreCase(String email);
    boolean existsByDisplayName(String displayName);
}


