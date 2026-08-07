package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.user.UserAccount;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "packing_scenarios")
public class PackingScenario {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "truck_width", nullable = false)
    private Integer truckWidth;

    @Column(name = "truck_height", nullable = false)
    private Integer truckHeight;

    @Column(name = "allow_rotate", nullable = false)
    private Boolean allowRotate = true;

    @Column(name = "margin")
    private Integer margin = 0;

    /**
     * sortOrder가 null인 예전 행은 Postgres에서 ASC 정렬 시 뒤로 밀리지만,
     * 그런 시나리오는 모든 행이 null이라 결국 id 순으로 떨어진다.
     * (수정 시 전체 행을 다시 쓰므로 한 시나리오 안에 null과 값이 섞이지 않는다)
     */
    @OneToMany(mappedBy = "scenario", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    private List<PackingItem> items;

    /**
     * 적재 시 물품 목록 순서를 그대로 쓸지 (false면 면적 큰 순 자동 정렬).
     *
     * nullable로 둔다. ddl-auto=update가 기존 행이 있는 테이블에 NOT NULL 컬럼을
     * 붙이려 하면 Postgres가 거부한다. 읽는 쪽에서 null을 false로 취급한다.
     */
    @Column(name = "preserve_order")
    private Boolean preserveOrder = false;

    @Column(name = "is_favorite", nullable = false)
    private Boolean isFavorite = false;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Constructors
    public PackingScenario() {}

    public PackingScenario(String name, UserAccount user, Integer truckWidth, Integer truckHeight) {
        this.name = name;
        this.user = user;
        this.truckWidth = truckWidth;
        this.truckHeight = truckHeight;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public UserAccount getUser() {
        return user;
    }

    public void setUser(UserAccount user) {
        this.user = user;
    }

    public Integer getTruckWidth() {
        return truckWidth;
    }

    public void setTruckWidth(Integer truckWidth) {
        this.truckWidth = truckWidth;
    }

    public Integer getTruckHeight() {
        return truckHeight;
    }

    public void setTruckHeight(Integer truckHeight) {
        this.truckHeight = truckHeight;
    }

    public Boolean getAllowRotate() {
        return allowRotate;
    }

    public void setAllowRotate(Boolean allowRotate) {
        this.allowRotate = allowRotate;
    }

    public Integer getMargin() {
        return margin;
    }

    public void setMargin(Integer margin) {
        this.margin = margin;
    }

    public List<PackingItem> getItems() {
        return items;
    }

    public void setItems(List<PackingItem> items) {
        this.items = items;
    }

    public Boolean getPreserveOrder() {
        return preserveOrder != null && preserveOrder;
    }

    public void setPreserveOrder(Boolean preserveOrder) {
        this.preserveOrder = preserveOrder != null && preserveOrder;
    }

    public Boolean getIsFavorite() {
        return isFavorite;
    }

    public void setIsFavorite(Boolean isFavorite) {
        this.isFavorite = isFavorite;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }
}
