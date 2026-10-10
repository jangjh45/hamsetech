package com.hamsetech.hamsetech.work;

import com.hamsetech.hamsetech.user.UserAccountRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** PostgreSQL 경합을 실제 트랜잭션으로 검증한다. */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
@ActiveProfiles("test")
class OvertimeConcurrencyIntegrationTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired private JdbcTemplate jdbc;
    @Autowired private OvertimeRecordRepository repository;
    @Autowired private OvertimeRecordService service;
    @Autowired private PlatformTransactionManager transactionManager;

    @Test
    @DisplayName("동시에 승인·반려해도 PENDING 상태 전이는 하나만 성공한다")
    void onlyOneConcurrentDecisionWins() throws Exception {
        long userId = createUser();
        long recordId = createRecord(userId);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            Future<Integer> approve = executor.submit(() -> {
                ready.countDown();
                awaitStart(start);
                return new TransactionTemplate(transactionManager).execute(status ->
                        repository.approveIfPending(recordId, "admin-a", Instant.now(),
                                OvertimeRecord.Status.PENDING, OvertimeRecord.Status.APPROVED));
            });
            Future<Integer> reject = executor.submit(() -> {
                ready.countDown();
                awaitStart(start);
                return new TransactionTemplate(transactionManager).execute(status ->
                        repository.rejectIfPending(recordId, "admin-b", Instant.now(), "반려",
                                OvertimeRecord.Status.PENDING, OvertimeRecord.Status.REJECTED));
            });

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            int approved = approve.get(10, TimeUnit.SECONDS);
            int rejected = reject.get(10, TimeUnit.SECONDS);
            assertThat(approved + rejected).isEqualTo(1);
            assertThat(jdbc.queryForObject(
                    "SELECT status FROM overtime_records WHERE id = ?", String.class, recordId))
                    .isIn("APPROVED", "REJECTED");
        } finally {
            executor.shutdownNow();
            deleteUser(userId);
        }
    }

    @Test
    @DisplayName("상태 전이 뒤에 저장되는 오래된 잔업 엔티티는 낙관적 잠금으로 거부한다")
    void rejectsStaleEntityAfterDecision() {
        long userId = createUser();
        long recordId = createRecord(userId);
        TransactionTemplate transactions = new TransactionTemplate(transactionManager);

        try {
            OvertimeRecord stale = transactions.execute(status -> repository.findById(recordId).orElseThrow());
            int changed = transactions.execute(status -> repository.approveIfPending(recordId, "admin",
                    Instant.now(), OvertimeRecord.Status.PENDING, OvertimeRecord.Status.APPROVED));
            assertThat(changed).isEqualTo(1);

            stale.setReason("stale edit");
            assertThatThrownBy(() -> transactions.execute(status -> repository.save(stale)))
                    .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
        } finally {
            deleteUser(userId);
        }
    }

    @Test
    @DisplayName("동시에 같은 일괄 등록을 보내도 중복 기록은 생기지 않는다")
    void serializesConcurrentBulkCreates() throws Exception {
        long userId = createUser();
        LocalDate date = LocalDate.of(2026, 10, 10);
        ExecutorService executor = Executors.newFixedThreadPool(2);
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);

        try {
            Future<OvertimeRecordService.BulkCreateResult> first = executor.submit(() -> {
                ready.countDown();
                awaitStart(start);
                return asAdmin(() -> service.createForUsers(List.of(userId), date, OvertimeType.OVERTIME,
                        null, null, 120, "동시 등록", false));
            });
            Future<OvertimeRecordService.BulkCreateResult> second = executor.submit(() -> {
                ready.countDown();
                awaitStart(start);
                return asAdmin(() -> service.createForUsers(List.of(userId), date, OvertimeType.OVERTIME,
                        null, null, 120, "동시 등록", false));
            });

            assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
            start.countDown();

            int totalCreated = first.get(10, TimeUnit.SECONDS).created()
                    + second.get(10, TimeUnit.SECONDS).created();
            assertThat(totalCreated).isEqualTo(1);
            assertThat(jdbc.queryForObject(
                    "SELECT count(*) FROM overtime_records WHERE user_id = ? AND work_date = ? AND type = ?",
                    Integer.class, userId, date, "OVERTIME")).isEqualTo(1);
        } finally {
            executor.shutdownNow();
            deleteUser(userId);
        }
    }

    private void awaitStart(CountDownLatch start) throws InterruptedException {
        if (!start.await(5, TimeUnit.SECONDS)) {
            throw new AssertionError("동시 요청 시작 신호를 받지 못했습니다");
        }
    }

    private <T> T asAdmin(java.util.function.Supplier<T> action) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken("admin", "test",
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))));
        SecurityContextHolder.setContext(context);
        try {
            return action.get();
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private long createUser() {
        String suffix = UUID.randomUUID().toString();
        return jdbc.queryForObject("""
                INSERT INTO users (username, email, password_hash, status)
                VALUES (?, ?, 'test-hash', 'APPROVED')
                RETURNING id
                """, Long.class, "concurrency-" + suffix, suffix + "@example.test");
    }

    private long createRecord(long userId) {
        return jdbc.queryForObject("""
                INSERT INTO overtime_records
                    (user_id, username, work_date, type, total_minutes, status,
                     created_at, updated_at, version)
                SELECT id, username, DATE '2026-10-10', 'OVERTIME', 60, 'PENDING', now(), now(), 0
                FROM users WHERE id = ?
                RETURNING id
                """, Long.class, userId);
    }

    private void deleteUser(long userId) {
        jdbc.update("DELETE FROM overtime_records WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM users WHERE id = ?", userId);
    }
}
