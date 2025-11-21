package com.hamsetech.hamsetech.admin;

import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.reflect.MethodSignature;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.lang.reflect.Method;
import java.lang.reflect.Parameter;

/**
 * @AdminLoggable 어노테이션이 붙은 메서드의 실행을 감지하여 자동으로 관리자 로그를 기록하는 Aspect
 */
@Aspect
@Component
public class AdminLoggingAspect {

    private static final Logger logger = LoggerFactory.getLogger(AdminLoggingAspect.class);

    private final AdminLogService adminLogService;

    public AdminLoggingAspect(AdminLogService adminLogService) {
        this.adminLogService = adminLogService;
    }

    /**
     * @AdminLoggable 어노테이션이 붙은 메서드 실행 후 로그 기록
     */
    @AfterReturning(
        pointcut = "@annotation(adminLoggable)",
        returning = "result"
    )
    public void logAdminAction(JoinPoint joinPoint, AdminLoggable adminLoggable, Object result) {
        try {
            // 관리자 권한 체크 (AdminLogService에서 이미 수행하지만 여기서도 확인)
            if (!adminLogService.isAdminUser()) {
                return; // 관리자가 아니면 로깅하지 않음
            }

            // Entity ID 추출
            Long entityId = extractEntityId(joinPoint, result);

            // 상세 정보 생성
            String details = buildDetails(adminLoggable, joinPoint);

            // 로그 기록
            adminLogService.logAdminAction(
                adminLoggable.action(),
                adminLoggable.entityType(),
                entityId,
                details
            );

            logger.debug("Admin log recorded: action={}, entityType={}, entityId={}", 
                adminLoggable.action(), adminLoggable.entityType(), entityId);

        } catch (Exception e) {
            logger.error("Failed to record admin log", e);
            // 로그 기록 실패가 비즈니스 로직에 영향을 주지 않도록 예외를 삼킴
        }
    }

    /**
     * Entity ID를 추출합니다.
     * 1. @PathVariable("id") 파라미터에서 추출
     * 2. 반환값에서 getId() 메서드 호출
     * 3. 추출 실패시 null 반환
     */
    private Long extractEntityId(JoinPoint joinPoint, Object result) {
        // 1. @PathVariable("id")에서 ID 추출 시도
        Long idFromPathVariable = extractIdFromPathVariable(joinPoint);
        if (idFromPathVariable != null) {
            return idFromPathVariable;
        }

        // 2. 반환값에서 ID 추출 시도
        if (result != null) {
            try {
                Method getIdMethod = result.getClass().getMethod("getId");
                Object id = getIdMethod.invoke(result);
                if (id instanceof Long) {
                    return (Long) id;
                }
            } catch (Exception e) {
                // getId() 메서드가 없거나 호출 실패
            }
        }

        // 3. ID를 찾지 못한 경우 null 반환 (목록 조회 등)
        return null;
    }

    /**
     * @PathVariable("id") 어노테이션에서 ID 값을 추출
     */
    private Long extractIdFromPathVariable(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Parameter[] parameters = method.getParameters();
        Object[] args = joinPoint.getArgs();

        for (int i = 0; i < parameters.length; i++) {
            PathVariable pathVariable = parameters[i].getAnnotation(PathVariable.class);
            if (pathVariable != null) {
                String name = pathVariable.value().isEmpty() ? pathVariable.name() : pathVariable.value();
                if ("id".equals(name) && args[i] instanceof Long) {
                    return (Long) args[i];
                }
            }
        }
        return null;
    }

    /**
     * 로그 상세 정보 생성
     */
    private String buildDetails(AdminLoggable adminLoggable, JoinPoint joinPoint) {
        StringBuilder details = new StringBuilder();

        // 어노테이션에서 지정한 기본 상세 정보
        if (!adminLoggable.details().isEmpty()) {
            details.append(adminLoggable.details());
        } else {
            // 기본 정보: 메서드명
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            details.append("Method: ").append(signature.getMethod().getName());
        }

        // HTTP 요청 정보 추가
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.currentRequestAttributes();
            HttpServletRequest request = attrs.getRequest();
            details.append(" | ").append(request.getMethod())
                   .append(" ").append(request.getRequestURI());
        } catch (Exception e) {
            // HTTP 요청 컨텍스트를 사용할 수 없는 경우 무시
        }

        return details.toString();
    }
}
