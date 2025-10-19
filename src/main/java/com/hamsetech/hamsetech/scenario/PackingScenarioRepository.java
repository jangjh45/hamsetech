package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.user.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PackingScenarioRepository extends JpaRepository<PackingScenario, Long> {
    
    List<PackingScenario> findByUserOrderByCreatedAtDesc(UserAccount user);
    
    List<PackingScenario> findByUserAndIsFavoriteTrueOrderByUpdatedAtDesc(UserAccount user);
    
    @Query("SELECT s FROM PackingScenario s WHERE s.user = :user AND " +
           "(LOWER(s.name) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(s.description) LIKE LOWER(CONCAT('%', :query, '%'))) " +
           "ORDER BY s.updatedAt DESC")
    List<PackingScenario> findByUserAndNameOrDescriptionContainingIgnoreCase(
        @Param("user") UserAccount user, 
        @Param("query") String query
    );
    
    boolean existsByUserAndName(UserAccount user, String name);
    
    @Query("SELECT s FROM PackingScenario s WHERE s.user = :user AND s.name = :name AND s.id != :excludeId")
    List<PackingScenario> findByUserAndNameExcludingId(@Param("user") UserAccount user, @Param("name") String name, @Param("excludeId") Long excludeId);
}
