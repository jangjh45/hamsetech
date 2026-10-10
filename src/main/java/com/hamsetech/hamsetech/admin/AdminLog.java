package com.hamsetech.hamsetech.admin;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "admin_logs")
public class AdminLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Instant timestamp;

    @Column(nullable = false)
    private String adminUsername;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private Action action;

    @Column(nullable = false)
    @Convert(converter = EntityTypeConverter.class)
    private EntityType entityType;

    @Column(nullable = true)
    private Long entityId;

    @Column(columnDefinition = "TEXT")
    private String details;

    private String ipAddress;

    public enum Action {
        CREATE, READ, UPDATE, DELETE
    }

    public enum EntityType {
        TODO, CALENDAR_EVENT, NOTICE, NOTICE_COMMENT, SCENARIO, OVERTIME_RECORD,
        VENDOR, VENDOR_CATEGORY,
        // 사용자 계정(권한/프로필) 및 인증(로그인·비밀번호) 이벤트
        USER, AUTH,
        // 삭제된 기능이지만 과거 로그가 남아 있어 조회를 위해 유지
        PROGRESS,
        // DB에 남아 있는 알 수 없는 값을 읽을 때 사용 (EntityTypeConverter)
        UNKNOWN
    }

    // 기본 생성자
    public AdminLog() {
        this.timestamp = Instant.now();
    }

    // 생성자 (entityId는 목록 조회 등에서 null 가능)
    public AdminLog(String adminUsername, Action action, EntityType entityType, Long entityId) {
        this();
        this.adminUsername = adminUsername;
        this.action = action;
        this.entityType = entityType;
        this.entityId = entityId;
    }

    // Getters and Setters
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

    public Action getAction() {
        return action;
    }

    public void setAction(Action action) {
        this.action = action;
    }

    public EntityType getEntityType() {
        return entityType;
    }

    public void setEntityType(EntityType entityType) {
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
