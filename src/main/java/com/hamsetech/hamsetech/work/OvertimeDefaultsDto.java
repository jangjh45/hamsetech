package com.hamsetech.hamsetech.work;

/**
 * 잔업/특근 기본 근무시간 조회·수정용 DTO. 시간은 "HH:mm" 문자열로 주고받는다.
 * payrollStartDay는 급여 정산 주기 시작일(1~28)로, 엑셀 내보내기 기본 기간을 채우는 데 쓴다.
 */
public record OvertimeDefaultsDto(
        String overtimeStart,
        String overtimeEnd,
        String specialStart,
        String specialEnd,
        Integer payrollStartDay) {
}
