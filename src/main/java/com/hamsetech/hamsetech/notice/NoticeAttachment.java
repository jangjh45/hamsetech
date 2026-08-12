package com.hamsetech.hamsetech.notice;

import jakarta.persistence.*;
import java.time.Instant;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "notice_attachments")
public class NoticeAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /**
     * 아직 글에 붙지 않은 첨부는 null이다.
     *
     * 파일은 글을 저장하기 전에 먼저 올라간다(본문에 이미지를 넣으려면 URL이 필요하다).
     * 그 사이 상태를 표현할 자리가 필요해서 nullable로 둔다. 저장하지 않고 나간 파일은
     * NoticeAttachmentSweeper가 나중에 정리한다.
     */
    @ManyToOne(fetch = FetchType.LAZY)
    @OnDelete(action = OnDeleteAction.CASCADE)
    private Notice notice;

    /** 내려받을 때 보여줄 이름. 디스크에는 절대 이 이름을 쓰지 않는다. */
    @Column(nullable = false, length = 255)
    private String originalFilename;

    @Column(nullable = false, length = 80, unique = true)
    private String storedFilename;

    /** 업로드 루트 기준 상대 경로 (yyyy/MM/{uuid}.{ext}). */
    @Column(nullable = false, length = 120)
    private String relativePath;

    /** 서버가 검증한 타입. 클라이언트가 보낸 값을 그대로 담지 않는다. */
    @Column(nullable = false, length = 120)
    private String contentType;

    @Column(nullable = false)
    private long fileSize;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private AttachmentKind kind;

    /** 글에 붙일 때 소유자를 확인해 남의 미확정 첨부를 가져가지 못하게 한다. */
    @Column(nullable = false, length = 100)
    private String uploaderUsername;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    public void prePersist() {
        createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public Notice getNotice() { return notice; }
    public void setNotice(Notice notice) { this.notice = notice; }
    public String getOriginalFilename() { return originalFilename; }
    public void setOriginalFilename(String originalFilename) { this.originalFilename = originalFilename; }
    public String getStoredFilename() { return storedFilename; }
    public void setStoredFilename(String storedFilename) { this.storedFilename = storedFilename; }
    public String getRelativePath() { return relativePath; }
    public void setRelativePath(String relativePath) { this.relativePath = relativePath; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public long getFileSize() { return fileSize; }
    public void setFileSize(long fileSize) { this.fileSize = fileSize; }
    public AttachmentKind getKind() { return kind; }
    public void setKind(AttachmentKind kind) { this.kind = kind; }
    public String getUploaderUsername() { return uploaderUsername; }
    public void setUploaderUsername(String uploaderUsername) { this.uploaderUsername = uploaderUsername; }
    public Instant getCreatedAt() { return createdAt; }
}
