package com.hamsetech.hamsetech.user;

/**
 * 계정 승인 상태. 회원가입은 누구나 신청할 수 있지만
 * 관리자가 APPROVED로 바꾸기 전에는 로그인할 수 없다.
 *
 * 탈퇴도 같은 축을 따른다. 사용자는 신청만 할 수 있고 확정은 관리자가 한다.
 */
public enum UserStatus {
    PENDING,
    APPROVED,
    REJECTED,
    /** 사용자가 탈퇴를 신청했으나 관리자 확정 전. 이 동안에도 로그인·신청 취소는 가능하다. */
    WITHDRAW_REQUESTED,
    /** 관리자가 탈퇴를 확정. 로그인 불가, 개인정보 익명화 완료. */
    WITHDRAWN
}


