package com.hamsetech.hamsetech.admin;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 관리자 활동 로그를 자동으로 기록하기 위한 어노테이션
 * 컨트롤러 메서드에 이 어노테이션을 추가하면 AOP를 통해 자동으로 로그가 기록됩니다.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface AdminLoggable {
    /**
     * 수행되는 작업 유형 (CREATE, READ, UPDATE, DELETE)
     */
    AdminLog.Action action();

    /**
     * 작업 대상 엔티티 타입
     */
    AdminLog.EntityType entityType();

    /**
     * 로그에 기록될 추가 정보 (선택사항)
     */
    String details() default "";

    /**
     * true(기본): 관리자 권한을 가진 사용자의 실행만 기록한다.
     * false: 일반 사용자의 실행도 기록한다. 잔업 신청·프로필 수정처럼
     * 일반 사용자가 수행하지만 이력이 남아야 하는 작업에 사용한다.
     */
    boolean adminOnly() default true;
}
