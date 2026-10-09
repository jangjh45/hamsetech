package com.hamsetech.hamsetech.notice;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 조회수 업서트 쿼리를 실제 PostgreSQL에서 확인한다.
 *
 * NoticeViewServiceTest는 리포지터리를 목으로 대체하므로 이 쿼리를 실행한 적이 없다.
 * 그런데 이 쿼리가 돌려주는 정수 하나(1이면 새 조회, 0이면 창 안 재방문)가 조회수
 * 전체의 정합성이다. 그리고 서비스는 예외를 전부 삼키므로, 쿼리가 어떤 이유로든
 * 깨지면 앱은 멀쩡히 뜨면서 조회수만 조용히 안 올라간다 — 아무도 모른다.
 *
 * H2로는 확인할 수 없다. ON CONFLICT (notice_id, username)는 지정된 유니크 제약이
 * 정확히 있어야 하고, make_interval은 PostgreSQL 전용이며, DO UPDATE ... WHERE가
 * 몇 행을 돌려주는지도 PostgreSQL의 동작이다.
 *
 * 시간 대기 없이 판정하기 위해 "창이 지났는지"를 실제로 기다리지 않는다.
 * last_viewed_at을 raw SQL로 되돌려 놓거나, 창 값에 음수를 넣어 조건을 뒤집는다.
 * 이러면 타임존과 now() 정밀도에 흔들리지 않는다.
 *
 * ddl-auto=validate를 유지해 Flyway가 만든 실제 스키마 위에 서게 한다. 엔티티에서
 * 새로 만든 스키마를 보면 유니크 제약이 어긋난 경우를 못 잡는다.
 *
 * Docker가 없으면 실행되지 않고 건너뛴다. SchemaMigrationTest와 같은 이유다.
 */
@Testcontainers(disabledWithoutDocker = true)
@DataJpaTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@ActiveProfiles("test")
class NoticeViewUpsertTest {

    /** 운영과 같은 메저 버전을 쓴다. */
    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private NoticeViewRepository viewRepository;

    @Autowired
    private NoticeRepository noticeRepository;

    @Autowired
    private JdbcTemplate jdbc;

    private Long noticeId;

    @BeforeEach
    void setUp() {
        Notice n = new Notice();
        n.setTitle("공지");
        n.setAuthorUsername("park");
        n.setContent("<p>본문</p>");
        noticeId = noticeRepository.saveAndFlush(n).getId();
    }

    private int rows() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM notice_views WHERE notice_id = ?", Integer.class, noticeId);
    }

    private Instant lastViewedAt(String username) {
        return jdbc.queryForObject(
                "SELECT last_viewed_at FROM notice_views WHERE notice_id = ? AND username = ?",
                (rs, i) -> rs.getObject(1, java.time.OffsetDateTime.class).toInstant(),
                noticeId, username);
    }

    @Test
    @DisplayName("첫 조회는 행을 만들고 1을 돌려준다")
    void firstViewInserts() {
        assertThat(viewRepository.touch(noticeId, "kim", 6)).isEqualTo(1);
        assertThat(rows()).isEqualTo(1);
    }

    @Test
    @DisplayName("창 안에 다시 열면 0을 돌려주고 행도 늘지 않는다")
    void revisitWithinWindowReturnsZero() {
        // 새로고침 연타와 StrictMode의 이펙트 2회 실행을 흡수하는 것이 이 쿼리의
        // 존재 이유다. 여기서 1이 나오면 조회수가 새고침마다 오른다.
        assertThat(viewRepository.touch(noticeId, "kim", 6)).isEqualTo(1);
        assertThat(viewRepository.touch(noticeId, "kim", 6)).isZero();
        assertThat(viewRepository.touch(noticeId, "kim", 6)).isZero();
        assertThat(rows()).isEqualTo(1);
    }

    @Test
    @DisplayName("창 값을 SQL이 실제로 받아 쓴다")
    void windowParameterReachesTheSql() {
        // 이게 이 테스트의 목적이다. hours => 가 mins => 로 슬립하거나 파라미터가
        // 리터럴로 박혀 있으면, 아래 두 번째 호출이 0이 되어 깨진다.
        // 6시간 창이 6분이 되어도 서버 테스트로는 아무것도 드러나지 않는다.
        //
        // 음수 창을 주면 WHERE( last_viewed_at < now() - make_interval(hours => -1) )
        // 가 항상 참이 된다. 같은 트랜잭션이라 now()이 같아도 성립한다.
        assertThat(viewRepository.touch(noticeId, "kim", 6)).isEqualTo(1);
        assertThat(viewRepository.touch(noticeId, "kim", -1)).isEqualTo(1);
    }

    @Test
    @DisplayName("창이 지나면 새 조회로 센다")
    void afterWindowCountsAsNewView() {
        // 10시간 전으로 되돌려 놓고 6시간 창을 대면 조건이 참이 되어야 한다.
        // 창이 실제로 '시간' 단위로 동작하는지, 비교가 되도록 되어 있는지도 함께 본다.
        viewRepository.touch(noticeId, "kim", 6);
        jdbc.update("UPDATE notice_views SET last_viewed_at = now() - interval '10 hours' WHERE username = 'kim'");

        assertThat(viewRepository.touch(noticeId, "kim", 6)).isEqualTo(1);
        assertThat(rows()).isEqualTo(1);
    }

    @Test
    @DisplayName("갱신되면 last_viewed_at이 새로워진다")
    void updateRefreshesTimestamp() {
        // now()는 트랜잭션 시작 시각이라 이 안에서는 값이 움직이지 않는다.
        // 대신 "안쪽의 오래된 값"과 비교한다 — WHERE가 걸러 UPDATE가 돌지 않았다면
        // last_viewed_at은 10시간 전 값 그대로 남는다. 새로워졌다는 것은 DO UPDATE가
        // 실제로 실행됐다는 뜻이다.
        viewRepository.touch(noticeId, "kim", 6);
        jdbc.update("UPDATE notice_views SET last_viewed_at = now() - interval '10 hours' WHERE username = 'kim'");
        Instant stale = lastViewedAt("kim");

        viewRepository.touch(noticeId, "kim", 6);

        assertThat(lastViewedAt("kim")).isAfter(stale);
    }

    @Test
    @DisplayName("사람이 다르면 따로 센다")
    void differentUserCountsSeparately() {
        assertThat(viewRepository.touch(noticeId, "kim", 6)).isEqualTo(1);
        assertThat(viewRepository.touch(noticeId, "park", 6)).isEqualTo(1);

        // park은 작성자지만 쿼리는 작성자를 모른다. 판정은 NoticeViewService가 한다.
        assertThat(rows()).isEqualTo(2);
    }

    @Test
    @DisplayName("글이 다르면 따로 센다")
    void differentNoticeCountsSeparately() {
        Notice other = new Notice();
        other.setTitle("다른 공지");
        other.setAuthorUsername("park");
        other.setContent("<p>본문</p>");
        Long otherId = noticeRepository.saveAndFlush(other).getId();

        assertThat(viewRepository.touch(noticeId, "kim", 6)).isEqualTo(1);
        assertThat(viewRepository.touch(otherId, "kim", 6)).isEqualTo(1);

        assertThat(rows()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM notice_views WHERE notice_id = ?",
                Integer.class, otherId)).isEqualTo(1);
    }

    @Test
    @DisplayName("ON CONFLICT이 기대하는 유니크 제약이 실제로 제어를 건다")
    void uniqueConstraintIsEnforced() {
        // pg_indexes에 이름이 보인다는 것과 실제로 중복을 막는다는 것은 다르다.
        // ON CONFLICT (notice_id, username)는 이 구성이 정확히 있어야만 실행된다.
        viewRepository.touch(noticeId, "kim", 6);

        assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO notice_views (notice_id, username, last_viewed_at) VALUES (?, ?, now())",
                noticeId, "kim"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("유니크 제약이 정확히 (notice_id, username) 위에 있다")
    void constraintColumnsMatchTheUpsert() {
        // ON CONFLICT의 컬럼 목록이 이 제약과 어긋나면 쿼리가 실행조차 못 한다.
        // SchemaMigrationTest가 인덱스 존재만 확인하므로, 컬럼 조합까지 본다.
        String cols = jdbc.queryForObject(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'uk_notice_views_notice_user'",
                String.class);

        assertThat(cols).isNotNull().contains("notice_id").contains("username");
    }
}