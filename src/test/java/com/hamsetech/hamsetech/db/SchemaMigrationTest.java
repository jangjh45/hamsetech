package com.hamsetech.hamsetech.db;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 마이그레이션이 실제로 쓸 수 있는 스키마를 만드는지 확인한다.
 *
 * H2로는 확인할 수 없는 것들이 있다 — 부분 인덱스, PostgreSQL 전용 CHECK 표현,
 * timestamp with time zone의 정밀도. 무엇보다 운영은 PostgreSQL인데 테스트는 H2라는
 * 구도 자체가 "테스트는 통과하는데 배포하면 깨지는" 상황을 만든다.
 *
 * 여기서는 빈 PostgreSQL 컨테이너에 V1부터 전부 적용한 뒤, Hibernate의
 * ddl-auto=validate가 엔티티와 스키마를 대조하게 한다. 컬럼 하나라도 어긋나면
 * 컨텍스트가 뜨지 않는다.
 *
 * 데이터소스는 &#64;ServiceConnection이 컨테이너에서 직접 가져온다. 환경변수보다
 * 우선하므로 도커 개발 환경에서도 엉뚱한 DB를 물지 않는다.
 *
 * Docker가 없는 환경에서는 실행되지 않고 건너뛴다. 빌드를 깨지 않되, 돌 수 있는
 * 곳에서는 반드시 돌게 하려는 의도다.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
		"spring.flyway.enabled=true",
		"spring.jpa.hibernate.ddl-auto=validate"
})
@ActiveProfiles("test")
class SchemaMigrationTest {

	/**
	 * 운영과 같은 메이저 버전을 쓴다(docker-compose의 postgres:16-alpine).
	 * static이라 이 클래스의 모든 테스트가 컨테이너 하나를 공유한다.
	 */
	@Container
	@ServiceConnection
	static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

	@Autowired
	private JdbcTemplate jdbc;

	@Test
	@DisplayName("빈 데이터베이스에 마이그레이션이 전부 적용된다")
	void allMigrationsApply() {
		// 컨텍스트가 떴다는 것 자체가 Flyway 성공 + ddl-auto=validate 통과를 뜻한다.
		List<String> applied = jdbc.queryForList(
				"SELECT version FROM flyway_schema_history WHERE success = true AND version IS NOT NULL "
						+ "ORDER BY installed_rank", String.class);

		assertThat(applied).containsExactly("1", "2", "3");
	}

	@Test
	@DisplayName("baseline이 엔티티가 쓰는 테이블을 모두 만든다")
	void baselineCreatesMappedTables() {
		List<String> tables = jdbc.queryForList(
				"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class);

		assertThat(tables).contains(
				"users", "user_roles",
				"notices", "notice_comments", "notice_attachments", "notice_views",
				"calendar_events", "todos",
				"packing_scenarios", "packing_items",
				"overtime_records", "overtime_default_times", "overtime_payroll_setting",
				"admin_logs", "admin_read_logs");
	}

	@Test
	@DisplayName("삭제된 기능이 남긴 테이블은 새로 만들지 않는다")
	void doesNotRecreateDeadTables() {
		// 기존 데이터베이스에는 남아 있지만(매핑이 없어 validate가 무시한다)
		// 새 데이터베이스까지 물려줄 이유는 없다.
		List<String> tables = jdbc.queryForList(
				"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class);

		assertThat(tables).doesNotContain("project_progress", "work_records");
	}

	@Test
	@DisplayName("토큰 세대 컬럼이 만들어진다")
	void tokenVersionColumnExists() {
		Integer count = jdbc.queryForObject(
				"SELECT count(*) FROM information_schema.columns "
						+ "WHERE table_name = 'users' AND column_name = 'token_version'", Integer.class);

		assertThat(count).isEqualTo(1);
	}

	@Test
	@DisplayName("조회 성능을 위해 더한 인덱스가 실제로 생긴다")
	void queryIndexesExist() {
		List<String> indexes = jdbc.queryForList(
				"SELECT indexname FROM pg_indexes WHERE schemaname = 'public'", String.class);

		assertThat(indexes).contains(
				"idx_overtime_records_user_work_date",
				"idx_overtime_records_work_date",
				"idx_overtime_records_status_work_date",
				"idx_admin_logs_timestamp",
				"idx_todos_user_date",
				"idx_calendar_events_date",
				"idx_user_roles_user",
				"idx_notice_comments_notice",
				"idx_packing_scenarios_user",
				"idx_packing_items_scenario");
	}

	@Test
	@DisplayName("첨부 고아 정리용 부분 인덱스는 조건까지 살아 있다")
	void orphanPartialIndexKeepsItsPredicate() {
		// H2에는 부분 인덱스가 없어 이 조건이 맞는지 확인할 방법이 없었다.
		String definition = jdbc.queryForObject(
				"SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_notice_attachments_orphan'", String.class);

		assertThat(definition).contains("WHERE (notice_id IS NULL)");
	}

	@Test
	@DisplayName("조회수 중복 방지가 기대는 유니크 제약이 있다")
	void noticeViewUniqueConstraintExists() {
		// 이 제약이 없으면 ON CONFLICT (notice_id, username) 업서트 자체가 에러가 난다.
		Integer count = jdbc.queryForObject(
				"SELECT count(*) FROM pg_indexes "
						+ "WHERE tablename = 'notice_views' AND indexdef LIKE '%UNIQUE%' "
						+ "AND indexdef LIKE '%notice_id%' AND indexdef LIKE '%username%'", Integer.class);

		assertThat(count).isGreaterThanOrEqualTo(1);
	}
}
