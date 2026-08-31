package com.hamsetech.hamsetech.scenario;

import com.hamsetech.hamsetech.user.UserAccount;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PackingScenarioRepository extends JpaRepository<PackingScenario, Long> {
    
    // 목록 응답에는 시나리오마다 items가 통째로 실린다. 그냥 두면 시나리오 수만큼
    // 추가 SELECT가 나가므로(N+1) 세 목록 조회 모두 items를 함께 읽는다.
    @EntityGraph(attributePaths = "items")
    List<PackingScenario> findByUserOrderByCreatedAtDesc(UserAccount user);

    @EntityGraph(attributePaths = "items")
    List<PackingScenario> findByUserAndIsFavoriteTrueOrderByUpdatedAtDesc(UserAccount user);

    @EntityGraph(attributePaths = "items")
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

    /** 회원 탈퇴 시 개인 데이터를 정리한다. 하위 packing_items는 orphanRemoval로 함께 지워진다. */
    void deleteByUser(UserAccount user);
}
