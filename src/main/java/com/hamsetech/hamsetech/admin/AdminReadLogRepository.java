package com.hamsetech.hamsetech.admin;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface AdminReadLogRepository extends JpaRepository<AdminReadLog, Long>, JpaSpecificationExecutor<AdminReadLog> {

    @Query("SELECT DISTINCT l.adminUsername FROM AdminReadLog l ORDER BY l.adminUsername")
    List<String> findDistinctAdminUsernames();

    @Query("SELECT COUNT(l) FROM AdminReadLog l WHERE l.timestamp >= :since")
    long countLogsSince(@Param("since") Instant since);

    @Modifying
    @Query("DELETE FROM AdminReadLog l WHERE l.timestamp < :cutoff")
    int deleteOlderThan(@Param("cutoff") Instant cutoff);
}
