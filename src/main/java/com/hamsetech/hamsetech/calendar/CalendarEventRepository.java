package com.hamsetech.hamsetech.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    @Query("select e from CalendarEvent e where e.date between :start and :end order by e.date, e.time nulls last, e.id")
    List<CalendarEvent> findByDateRange(@Param("start") LocalDate start, @Param("end") LocalDate end);
}


