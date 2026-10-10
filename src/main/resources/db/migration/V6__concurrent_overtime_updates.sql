-- 동시 승인·반려와 오래된 엔티티의 덮어쓰기를 감지한다.
ALTER TABLE overtime_records
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

-- 런타임에 두 요청이 동시에 기본값을 처음 만들 필요가 없도록 기본 행을 미리 넣는다.
-- 기존 관리자가 설정한 값은 ON CONFLICT/NOT EXISTS로 그대로 보존한다.
INSERT INTO overtime_default_times (type, start_time, end_time, updated_at)
VALUES
    ('OVERTIME', TIME '16:00', TIME '19:00', now()),
    ('SPECIAL', TIME '07:00', TIME '16:00', now())
ON CONFLICT (type) DO NOTHING;

INSERT INTO overtime_payroll_setting (cycle_start_day, updated_at)
SELECT 1, now()
WHERE NOT EXISTS (SELECT 1 FROM overtime_payroll_setting);
