package com.hamsetech.hamsetech.user;

/**
 * 계정 승인 상태. 회원가입은 누구나 신청할 수 있지만
 * 관리자가 APPROVED로 바꾸기 전에는 로그인할 수 없다.
 */
public enum UserStatus {
    PENDING,
    APPROVED,
    REJECTED
}


