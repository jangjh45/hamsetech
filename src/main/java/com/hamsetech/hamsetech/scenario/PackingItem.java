package com.hamsetech.hamsetech.scenario;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "packing_items")
public class PackingItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "scenario_id", nullable = false)
    private PackingScenario scenario;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private Integer width;

    @Column(nullable = false)
    private Integer height;

    @Column(nullable = false)
    private Integer quantity = 1;

    /**
     * 물품 목록에서의 순서. 적재 우선순위로 쓰이므로 저장해야 한다.
     *
     * 이 컬럼이 생기기 전에 저장된 행은 null이다. 그래서 nullable로 두고,
     * 정렬은 PackingScenario에서 sortOrder 다음 id로 떨어지게 해 예전 시나리오도
     * 저장 당시 순서(= id 순)를 유지한다.
     */
    @Column(name = "sort_order")
    private Integer sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Constructors
    public PackingItem() {}

    public PackingItem(PackingScenario scenario, String name, Integer width, Integer height, Integer quantity) {
        this.scenario = scenario;
        this.name = name;
        this.width = width;
        this.height = height;
        this.quantity = quantity;
    }

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    // Getters and Setters
    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public PackingScenario getScenario() {
        return scenario;
    }

    public void setScenario(PackingScenario scenario) {
        this.scenario = scenario;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getWidth() {
        return width;
    }

    public void setWidth(Integer width) {
        this.width = width;
    }

    public Integer getHeight() {
        return height;
    }

    public void setHeight(Integer height) {
        this.height = height;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
