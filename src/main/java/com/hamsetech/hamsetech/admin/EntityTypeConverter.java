package com.hamsetech.hamsetech.admin;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * admin_logs.entity_type 컬럼 변환기.
 *
 * <p>기능이 제거되어 enum 상수가 사라져도 과거 로그 행이 DB에 남기 때문에,
 * {@code @Enumerated(EnumType.STRING)}으로 읽으면 조회 전체가 500으로 실패한다.
 * 알 수 없는 값은 {@link AdminLog.EntityType#UNKNOWN}으로 읽어 조회가 깨지지 않도록 한다.
 */
@Converter
public class EntityTypeConverter implements AttributeConverter<AdminLog.EntityType, String> {

    private static final Logger logger = LoggerFactory.getLogger(EntityTypeConverter.class);

    @Override
    public String convertToDatabaseColumn(AdminLog.EntityType attribute) {
        return attribute == null ? null : attribute.name();
    }

    @Override
    public AdminLog.EntityType convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return AdminLog.EntityType.UNKNOWN;
        }
        try {
            return AdminLog.EntityType.valueOf(dbData.trim());
        } catch (IllegalArgumentException e) {
            logger.warn("Unknown admin_logs.entity_type value '{}' -> UNKNOWN", dbData);
            return AdminLog.EntityType.UNKNOWN;
        }
    }
}
