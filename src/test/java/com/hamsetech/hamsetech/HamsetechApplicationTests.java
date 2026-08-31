package com.hamsetech.hamsetech;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 애플리케이션 배선 검증.
 *
 * 이 테스트가 잡는 것은 "빈이 전부 엮이는가"다 — 빈 누락, 순환 의존,
 * &#64;ConfigurationProperties 바인딩 실패. 값싸고 넓은 그물이라, Docker가 없는
 * 곳에서도 돌도록 H2로 띄운다.
 *
 * 스키마는 여기서 검증하지 않는다. Flyway를 끄고 Hibernate가 엔티티에서 H2 스키마를
 * 직접 만들게 둔다. 마이그레이션이 실제로 맞는 스키마를 만드는지는
 * {@link com.hamsetech.hamsetech.db.SchemaMigrationTest}가 진짜 PostgreSQL로 확인한다.
 *
 * 데이터소스를 여기에 직접 박은 이유가 있다. application-test.yml에 두면
 * 환경변수(SPRING_DATASOURCE_URL 등)가 우선순위에서 이긴다. 도커 개발 환경에는 그
 * 변수가 떠 있어서, H2 드라이버에 PostgreSQL URL이 물려 컨텍스트 로딩이 깨졌다.
 * &#64;SpringBootTest(properties)는 환경변수보다 우선순위가 높아 그 오염을 막는다.
 */
@SpringBootTest(properties = {
		"spring.datasource.url=jdbc:h2:mem:hamsetech;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
		"spring.datasource.driver-class-name=org.h2.Driver",
		"spring.datasource.username=sa",
		"spring.datasource.password=",
		"spring.flyway.enabled=false",
		"spring.jpa.hibernate.ddl-auto=create-drop",
		"spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.H2Dialect"
})
@ActiveProfiles("test")
class HamsetechApplicationTests {

	@Test
	void contextLoads() {
	}

}
