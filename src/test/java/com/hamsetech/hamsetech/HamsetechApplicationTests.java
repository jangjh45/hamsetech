package com.hamsetech.hamsetech;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * 애플리케이션 배선 검증.
 *
 * 이 테스트가 잡는 것은 "빈이 전부 엮이는가"다 — 빈 누락, 순환 의존,
 * @ConfigurationProperties 바인딩 실패. 값싸고 넓은 그물이라 남겨 둔다.
 *
 * 이 테스트가 잡지 못하는 것은 DB 동작이다. 여기서는 H2가 ddl-auto=create-drop으로
 * 엔티티에서 스키마를 새로 만들지만, 운영은 ddl-auto=update와 SchemaFixer가 만든다.
 * 생성 경로가 아예 다르고, SchemaFixer는 @Profile("!test")라 여기서 돌지도 않는다.
 * 부분 인덱스나 nulls last 같은 PostgreSQL 전용 동작도 확인되지 않는다.
 * 그쪽은 Testcontainers를 붙일 때의 몫이고, 그때 H2를 걷어내면 된다.
 */
@SpringBootTest
@ActiveProfiles("test")
class HamsetechApplicationTests {

	@Test
	void contextLoads() {
	}

}
