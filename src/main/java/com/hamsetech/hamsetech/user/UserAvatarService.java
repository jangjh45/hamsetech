package com.hamsetech.hamsetech.user;

import com.hamsetech.hamsetech.notice.AttachmentKind;
import com.hamsetech.hamsetech.notice.AttachmentStorage;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;
import java.util.UUID;

/** 프로필 사진 메타데이터와 업로드 디스크 파일의 수명을 함께 관리한다. */
@Service
public class UserAvatarService {

    private final UserAccountRepository userRepository;
    private final AttachmentStorage storage;

    public UserAvatarService(UserAccountRepository userRepository, AttachmentStorage storage) {
        this.userRepository = userRepository;
        this.storage = storage;
    }

    @Transactional
    public UserAccount replace(UserAccount user, MultipartFile file) {
        AttachmentStorage.Stored stored = storage.store(file, AttachmentKind.IMAGE);
        String previousPath = user.getAvatarPath();
        String avatarKey = UUID.randomUUID().toString();

        user.setAvatarPath(stored.relativePath());
        user.setAvatarContentType(stored.contentType());
        user.setAvatarKey(avatarKey);
        scheduleFileCleanup(previousPath, stored.relativePath());
        return userRepository.save(user);
    }

    @Transactional
    public UserAccount clear(UserAccount user) {
        String previousPath = user.getAvatarPath();
        if (previousPath == null) return user;

        user.setAvatarPath(null);
        user.setAvatarContentType(null);
        user.setAvatarKey(null);
        scheduleFileCleanup(previousPath, null);
        return userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Optional<AvatarFile> findByKey(String key) {
        return userRepository.findByAvatarKey(key)
                .filter(user -> user.getAvatarPath() != null && user.getAvatarContentType() != null)
                .map(user -> new AvatarFile(storage.load(user.getAvatarPath()), user.getAvatarContentType()))
                .filter(file -> Files.isRegularFile(file.path()));
    }

    public static String avatarUrl(String avatarKey) {
        return avatarKey == null ? null : "/api/users/avatars/" + avatarKey;
    }

    private void scheduleFileCleanup(String deleteAfterCommit, String deleteAfterRollback) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            if (deleteAfterCommit != null) storage.delete(deleteAfterCommit);
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                if (deleteAfterCommit != null) storage.delete(deleteAfterCommit);
            }

            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED && deleteAfterRollback != null) {
                    storage.delete(deleteAfterRollback);
                }
            }
        });
    }

    public record AvatarFile(Path path, String contentType) {
        public Resource resource() {
            return new FileSystemResource(path);
        }
    }
}
