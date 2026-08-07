package com.hamsetech.hamsetech.work;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OvertimePayrollSettingRepository extends JpaRepository<OvertimePayrollSetting, Long> {

    /** 설정은 한 행만 유지되지만, 어떤 이유로 여러 행이 생기더라도 항상 같은 행을 읽도록 고정한다. */
    Optional<OvertimePayrollSetting> findTopByOrderByIdAsc();
}
