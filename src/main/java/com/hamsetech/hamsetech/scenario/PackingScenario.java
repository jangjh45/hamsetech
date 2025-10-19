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

    @OneToMany(mappedBy = "scenario", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PackingItem> items;

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
