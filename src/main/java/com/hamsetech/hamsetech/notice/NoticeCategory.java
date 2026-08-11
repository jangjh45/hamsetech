package com.hamsetech.hamsetech.notice;

/**
 * 공지 분류.
 *
 * 값을 추가하면 DB의 CHECK 제약도 함께 넓혀야 한다. NoticeSchemaFixer가 기동 때마다
 * 이 enum을 기준으로 제약을 다시 만들어 주므로 여기만 고치면 된다.
 */
public enum NoticeCategory {
    GENERAL,
    HR,
    SAFETY,
    FACILITY,
    EVENT,
    SYSTEM
}
