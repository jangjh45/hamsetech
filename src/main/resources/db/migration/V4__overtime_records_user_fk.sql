-- 잔업 기록의 user_id에 외래 키를 건다.
--
-- 왜 필요한가: user_id 값은 이미 코드에서 정확히 채워지고 있었다
-- (OvertimeRecordService가 record.setUserId(user.getId())). 그랬는데 제약이
-- 없었다. 그래서 값이 틀리거나 행이 지워져도 아무도 몰랐다. notice_views는 같은
-- 모양(upser��� 키로 쓰이는 테이블)에 이미 fk가 붙어 있는데, 여기가 빠져 있었다.
--
-- 왜 안전하다: 탈퇴는 논리 삭제로만 일어난다. UserWithdrawalService가 상태를 바꾸고
-- 행은 지우지 않는다 — username 문자열로 작성자를 식별하는 기록(잔업·공지·캘린더)이
-- 그대로 남아야 하기 때문이다. 그래서 이 제약의 ON DELETE는 사실상 발동하지 않고,
-- RESTRICT로 두면 된다. 실제로 삭제가 일어나는 곳이 생기면 그때 CASCADE/SET NULL을
-- 정하는 편이 낫다.
--
-- 주의: 기존 행 중 user_id가 users를 가리키지 않는 것이 있으면 이 마이그레이션이
-- 실패하며, ddl-auto=validate와 Flyway 조합상 그때 기동이 멈춘다. 운영 배포 전에
-- 아래를 먼저 확인한다.
--   SELECT count(*) FROM overtime_records o
--   LEFT JOIN users u ON u.id = o.user_id
--   WHERE u.id IS NULL;
-- 값이 0이 아니면 무엇을 할지 먼저 정하고 올릴 것.

ALTER TABLE overtime_records
    ADD CONSTRAINT fk_overtime_records_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

-- 같은 user_id 안에서 집계하거나 목록을 내는 경로가 많아 FK가 없으면 인덱스가
-- 전부 풀스캔이었다. 제약은 인덱스를 만들지 않으므로 따로 건다.
CREATE INDEX IF NOT EXISTS idx_overtime_records_user_id
    ON overtime_records (user_id);