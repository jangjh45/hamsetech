-- 기동 시 돌던 CommandLineRunner들이 하던 데이터 백필.
--
-- 이 작업들은 그동안 매 기동마다 실행됐고 대부분의 데이터베이스에는 이미 적용돼
-- 있다. 그래도 여기로 옮기는 이유는, 이들이 스키마 제약으로 강제되지 않는
-- "데이터" 보정이기 때문이다. 컬럼 NOT NULL 여부만 보고 "이미 됐겠지" 하고 지우면,
-- 아직 새 코드를 한 번도 띄우지 않은 데이터베이스에서 조용히 어긋난다.
--
-- 전부 대상이 없으면 0건을 고치고 끝난다.

-- 승인제 도입 이전에 만들어진 계정.
-- NULL은 미승인으로 취급되므로, 백필하지 않으면 기존 사용자 전원이 로그인하지 못한다.
UPDATE users SET status = 'APPROVED' WHERE status IS NULL;

-- 검색용 평문 사본. 이 컬럼이 생기기 전 글은 본문이 곧 평문이라 그대로 복사한다.
-- content_text가 비어 있으면 본문 검색에서 그 글만 빠진다.
UPDATE notices SET content_text = content WHERE content_text IS NULL;

-- scope 도입 이전 일정. 그때는 전 사용자가 같은 목록을 봤으므로 COMPANY가 맞다.
-- PRIVATE로 채우면 주인 없는 일정이 전부 사라진다.
UPDATE calendar_events SET scope = 'COMPANY' WHERE scope IS NULL;

-- 예전에는 조회(READ) 기록이 admin_logs에 섞여 있었다. 조회는 양이 많아 보존기간을
-- 두고 정리해야 해서 별도 테이블로 분리했다. 남아 있는 행을 옮긴다.
INSERT INTO admin_read_logs (timestamp, admin_username, entity_type, entity_id, details, ip_address)
SELECT timestamp, admin_username, entity_type, entity_id, details, ip_address
FROM admin_logs
WHERE action = 'READ';

DELETE FROM admin_logs WHERE action = 'READ';
