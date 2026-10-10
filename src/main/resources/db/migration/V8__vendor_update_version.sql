-- 업체 정보와 담당자 목록을 함께 수정할 때 오래된 화면의 덮어쓰기를 감지한다.
ALTER TABLE vendors
    ADD COLUMN version integer NOT NULL DEFAULT 0;
