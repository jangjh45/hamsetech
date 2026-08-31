-- 토큰 세대 컬럼과, 실제 쿼리가 쓰는 인덱스.
--
-- IF NOT EXISTS를 붙인 이유: ddl-auto=update로 굴러온 개발 데이터베이스에는 이미
-- token_version이 만들어져 있을 수 있다. 그런 환경에서도 이 마이그레이션이
-- 한 번은 실행되므로, 있으면 넘어가야 한다.
--
-- 인덱스는 CONCURRENTLY 없이 만든다. 그동안 해당 테이블에 쓰기 잠금이 걸리지만
-- 사내 시스템 규모에서는 순간이고, CONCURRENTLY는 트랜잭션 밖에서 돌아야 해서
-- 마이그레이션 스크립트가 복잡해진다. 데이터가 크게 늘면 그때 나눠 잡는다.

-- ── 토큰 무효화 ───────────────────────────────────────────────────
-- 비밀번호 변경·초기화·탈퇴 확정 시 1 올린다. 인증 필터가 토큰의 tv 클레임과
-- 대조해 옛 토큰을 걸러낸다. 기존 행은 NULL이며 게터가 0으로 읽는다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version integer;

-- ── 잔업/특근 ─────────────────────────────────────────────────────
-- 내 기록 조회: user_id로 좁히고 work_date로 정렬한다.
CREATE INDEX IF NOT EXISTS idx_overtime_records_user_work_date
    ON overtime_records (user_id, work_date);

-- 관리자 목록·엑셀 내보내기: 기간으로 좁히고 work_date로 정렬한다.
CREATE INDEX IF NOT EXISTS idx_overtime_records_work_date
    ON overtime_records (work_date);

-- 기간 집계: 승인 건만 기간으로 훑는다.
CREATE INDEX IF NOT EXISTS idx_overtime_records_status_work_date
    ON overtime_records (status, work_date);

-- ── 감사 로그 ─────────────────────────────────────────────────────
-- 목록은 항상 timestamp 역순이고 기간 필터가 붙는다.
-- admin_read_logs 쪽 인덱스는 baseline에 이미 있다.
CREATE INDEX IF NOT EXISTS idx_admin_logs_timestamp
    ON admin_logs (timestamp);

-- ── 할 일 · 일정 ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_todos_user_date ON todos (user_id, date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_date ON calendar_events (date);

-- ── 외래키 컬럼 ───────────────────────────────────────────────────
-- PostgreSQL은 외래키를 걸어도 참조하는 쪽에 인덱스를 만들어 주지 않는다.
-- 아래는 전부 "부모로 자식을 찾는" 조회에 쓰인다.
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles (user_id);
CREATE INDEX IF NOT EXISTS idx_notice_comments_notice ON notice_comments (notice_id);
CREATE INDEX IF NOT EXISTS idx_packing_scenarios_user ON packing_scenarios (user_id);
CREATE INDEX IF NOT EXISTS idx_packing_items_scenario ON packing_items (scenario_id);
