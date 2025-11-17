package com.hamsetech.hamsetech.admin;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AdminLogRepository extends JpaRepository<AdminLog, Long>, JpaSpecificationExecutor<AdminLog> {

    Page<AdminLog> findAllByOrderByTimestampDesc(Pageable pageable);

    Page<AdminLog> findByAdminUsernameOrderByTimestampDesc(String adminUsername, Pageable pageable);

    Page<AdminLog> findByEntityTypeOrderByTimestampDesc(AdminLog.EntityType entityType, Pageable pageable);

    Page<AdminLog> findByActionOrderByTimestampDesc(AdminLog.Action action, Pageable pageable);

    @Query("SELECT l FROM AdminLog l WHERE l.timestamp BETWEEN :startDate AND :endDate ORDER BY l.timestamp DESC")
    Page<AdminLog> findByDateRange(@Param("startDate") Instant startDate, @Param("endDate") Instant endDate, Pageable pageable);

    @Query("SELECT DISTINCT l.adminUsername FROM AdminLog l ORDER BY l.adminUsername")
    List<String> findDistinctAdminUsernames();

    @Query("SELECT COUNT(l) FROM AdminLog l WHERE l.timestamp >= :since")
    long countLogsSince(@Param("since") Instant since);

    @Query("SELECT COUNT(l) FROM AdminLog l WHERE l.adminUsername = :adminUsername AND l.timestamp >= :since")
    long countLogsByAdminSince(@Param("adminUsername") String adminUsername, @Param("since") Instant since);
}
