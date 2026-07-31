package com.hamsetech.hamsetech.calendar;

/**
 * 일정 공개 범위.
 *
 * 조직에 부서/팀 개념이 없어 두 단계로 충분하다. 부서 단위 공유가 필요해지면
 * 사용자 모델에 소속을 추가한 뒤 여기에 값을 하나 더 넣는 방향으로 확장한다.
 */
public enum CalendarScope {

    /** 전 직원이 보는 사내 일정 (납품일, 라인 점검, 휴무 등) */
    COMPANY,

    /** 등록한 본인에게만 보이는 개인 일정 */
    PRIVATE
}
