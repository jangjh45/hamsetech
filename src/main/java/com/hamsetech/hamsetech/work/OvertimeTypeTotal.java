package com.hamsetech.hamsetech.work;

/**
 * 한 직원의 한 구분(잔업/특근)에 대한 기간 합계. GROUP BY 결과 한 줄이다.
 *
 * @param minutes 합계 분. 해당 구분의 기록이 없으면 이 행 자체가 나오지 않는다.
 * @param days    기록 건수. 하루에 두 건을 넣으면 2로 세는데, 집계 화면이
 *                예전부터 그렇게 세어 왔으므로 그대로 둔다.
 */
public record OvertimeTypeTotal(String username, String displayName, OvertimeType type,
                                Long minutes, Long days) {
}
