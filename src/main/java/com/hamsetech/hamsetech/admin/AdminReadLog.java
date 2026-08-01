package com.hamsetech.hamsetech.admin;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * 조회(READ) 이력 전용 로그.
 *
 * <p>조회 로그는 변경 이력보다 수십 배 빠르게 쌓여 실제 변경 이력을 묻어버리므로
 * {@link AdminLog}(생성/수정/삭제)와 테이블을 분리해 보관하고, 보존기간이 지나면
 * {@link AdminReadLogRetention}이 정리한다.
 */
@Entity
@Table(name = "admin_read_logs", indexes = {
        @Index(name = "idx_admin_read_logs_timestamp", columnList = "timestamp")
})
public class AdminReadLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(nullable = false)
    private String adminUsername;

    @Column(nullable = false)
    @Convert(converter = EntityTypeConverter.class)
    private AdminLog.EntityType entityType;

    @Column(nullable = true)
    private Long entityId;

    @Column(columnDefinition = "TEXT")
    private String details;

    private String ipAddress;

    public AdminReadLog() {
        this.timestamp = Instant.now();
    }

    public AdminReadLog(String adminUsername, AdminLog.EntityType entityType, Long entityId) {
        this();
        this.adminUsername = adminUsername;
        this.entityType = entityType;
        this.entityId = entityId;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getAdminUsername() {
        return adminUsername;
    }

    public void setAdminUsername(String adminUsername) {
        this.adminUsername = adminUsername;
    }

    public AdminLog.EntityType getEntityType() {
        return entityType;
    }

    public void setEntityType(AdminLog.EntityType entityType) {
        this.entityType = entityType;
    }

    public Long getEntityId() {
        return entityId;
    }

    public void setEntityId(Long entityId) {
        this.entityId = entityId;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }
}
