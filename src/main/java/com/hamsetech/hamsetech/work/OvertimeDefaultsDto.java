package com.hamsetech.hamsetech.work;

/**
 * 잔업/특근 기본 근무시간 조회·수정용 DTO. 시간은 "HH:mm" 문자열로 주고받는다.
 */
public record OvertimeDefaultsDto(
        String overtimeStart,
        String overtimeEnd,
        String specialStart,
        String specialEnd) {
}
