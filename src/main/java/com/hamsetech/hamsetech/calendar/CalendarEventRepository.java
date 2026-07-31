package com.hamsetech.hamsetech.calendar;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface CalendarEventRepository extends JpaRepository<CalendarEvent, Long> {

    /**
     * 볼 수 있는 일정만 돌려준다. 사내 일정은 누구나, 개인 일정은 등록한 본인만.
     *
     * 비로그인 조회는 username에 빈 문자열을 넘긴다. 사용자명은 빈 값일 수 없으므로
     * 개인 일정과는 절대 매칭되지 않는다. scope가 null인 행은 이 기능 도입 이전에
     * 등록되어 모두에게 보이던 일정이라 사내 일정으로 취급한다.
     */
    @Query("select e from CalendarEvent e where e.date between :start and :end "
            + "and (e.scope is null or e.scope = :company or e.createdByUsername = :username) "
            + "order by e.date, e.time nulls last, e.id")
    List<CalendarEvent> findVisibleByDateRange(@Param("start") LocalDate start,
                                               @Param("end") LocalDate end,
                                               @Param("company") CalendarScope company,
                                               @Param("username") String username);
}
