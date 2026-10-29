package com.hamsetech.hamsetech.scenario;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/**
 * 적재함 프리셋 (차량 적재함 내측 치수, mm).
 *
 * 시나리오는 치수를 복사해 가지므로 프리셋을 바꾸거나 지워도 저장된 시나리오에는 영향이 없다.
 */
@Entity
@Table(name = "truck_presets")
public class TruckPreset {

    public static final int MAX_LABEL_LENGTH = 50;
    public static final int MAX_DIMENSION_MM = 20000;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = MAX_LABEL_LENGTH)
    private String label;

    @Column(nullable = false)
    private Integer width;

    @Column(nullable = false)
    private Integer height;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder = 0;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public TruckPreset() {}

    public TruckPreset(String label, Integer width, Integer height, Integer sortOrder) {
        this.label = label;
        this.width = width;
        this.height = height;
        this.sortOrder = sortOrder;
    }

    public Long getId() { return id; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public Integer getWidth() { return width; }
    public void setWidth(Integer width) { this.width = width; }
    public Integer getHeight() { return height; }
    public void setHeight(Integer height) { this.height = height; }
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
}
