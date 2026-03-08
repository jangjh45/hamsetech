package com.hamsetech.hamsetech.admin;

import jakarta.servlet.http.HttpServletRequest;
import org.aspectj.lang.JoinPoint;
import org.aspectj.lang.annotation.AfterReturning;
import org.aspectj.lang.annotation.AfterThrowing;
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
     * @AdminLoggable 어노테이션이 붙은 메서드 실행 성공 후 로그 기록
     */
    @AfterReturning(
        pointcut = "@annotation(adminLoggable)",
        returning = "result"
    )
    public void logAdminAction(JoinPoint joinPoint, AdminLoggable adminLoggable, Object result) {
        try {
            if (!adminLogService.isAdminUser()) {
                return;
            }

            Long entityId = extractEntityId(joinPoint, result);
            String details = buildDetails(adminLoggable, joinPoint);

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
        }
    }

    /**
     * @AdminLoggable 어노테이션이 붙은 메서드 실행 실패 시 에러 로그 기록
     */
    @AfterThrowing(
        pointcut = "@annotation(adminLoggable)",
        throwing = "ex"
    )
    public void logAdminActionFailure(JoinPoint joinPoint, AdminLoggable adminLoggable, Throwable ex) {
        try {
            if (!adminLogService.isAdminUser()) {
                return;
            }

            Long entityId = extractEntityId(joinPoint, null);
            String details = buildDetails(adminLoggable, joinPoint) + " | FAILED: " + ex.getMessage();

            adminLogService.logAdminAction(
                adminLoggable.action(),
                adminLoggable.entityType(),
                entityId,
                details
            );

            logger.debug("Admin failure log recorded: action={}, entityType={}, error={}",
                adminLoggable.action(), adminLoggable.entityType(), ex.getMessage());

        } catch (Exception e) {
            logger.error("Failed to record admin failure log", e);
        }
    }

    /**
     * Entity ID를 추출합니다.
     * 1. @PathVariable이 붙은 Long 타입 파라미터에서 추출 ("id" 우선, 없으면 첫 번째 Long)
     * 2. 반환값에서 getId() 메서드 호출
     * 3. 추출 실패 시 null 반환
     */
    private Long extractEntityId(JoinPoint joinPoint, Object result) {
        Long idFromPathVariable = extractIdFromPathVariable(joinPoint);
        if (idFromPathVariable != null) {
            return idFromPathVariable;
        }

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

        return null;
    }

    /**
     * @PathVariable이 붙은 Long 파라미터에서 ID 추출.
     * "id" 이름을 우선하고, 없으면 Long 타입의 첫 번째 PathVariable을 사용.
     */
    private Long extractIdFromPathVariable(JoinPoint joinPoint) {
        MethodSignature signature = (MethodSignature) joinPoint.getSignature();
        Method method = signature.getMethod();
        Parameter[] parameters = method.getParameters();
        Object[] args = joinPoint.getArgs();

        Long firstLongPathVar = null;

        for (int i = 0; i < parameters.length; i++) {
            PathVariable pathVariable = parameters[i].getAnnotation(PathVariable.class);
            if (pathVariable != null && args[i] instanceof Long) {
                String name = pathVariable.value().isEmpty() ? pathVariable.name() : pathVariable.value();
                // "id"가 포함된 이름을 우선 반환
                if (name.equalsIgnoreCase("id") || name.toLowerCase().endsWith("id")) {
                    return (Long) args[i];
                }
                // 아니면 첫 번째 Long PathVariable 저장
                if (firstLongPathVar == null) {
                    firstLongPathVar = (Long) args[i];
                }
            }
        }

        return firstLongPathVar;
    }

    /**
     * 로그 상세 정보 생성
     */
    private String buildDetails(AdminLoggable adminLoggable, JoinPoint joinPoint) {
        StringBuilder details = new StringBuilder();

        if (!adminLoggable.details().isEmpty()) {
            details.append(adminLoggable.details());
        } else {
            MethodSignature signature = (MethodSignature) joinPoint.getSignature();
            details.append("Method: ").append(signature.getMethod().getName());
        }

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
