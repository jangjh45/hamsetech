package com.hamsetech.hamsetech.todo;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import com.hamsetech.hamsetech.user.UserAccount;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface TodoRepository extends JpaRepository<Todo, Long> {
    
    @Query("SELECT t FROM Todo t WHERE t.user = :user AND t.date BETWEEN :start AND :end ORDER BY t.date ASC, t.priority DESC, t.completed ASC")
    List<Todo> findByUserAndDateRange(@Param("user") UserAccount user, @Param("start") LocalDate start, @Param("end") LocalDate end);
    
    @Query("SELECT t FROM Todo t WHERE t.user = :user AND t.date = :date ORDER BY t.priority DESC, t.completed ASC")
    List<Todo> findByUserAndDate(@Param("user") UserAccount user, @Param("date") LocalDate date);
    
    @Query("SELECT COUNT(t) FROM Todo t WHERE t.user = :user AND t.id = :id")
    int countByUserAndId(@Param("user") UserAccount user, @Param("id") Long id);
} 