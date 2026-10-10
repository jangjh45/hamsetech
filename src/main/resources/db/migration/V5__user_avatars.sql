-- 사용자 프로필 사진. 파일 자체는 기존 업로드 볼륨에 저장하고 DB에는 경로와
-- 파일 형식, 추측할 수 없는 URL 키만 둔다.
ALTER TABLE users
    ADD COLUMN avatar_path varchar(255),
    ADD COLUMN avatar_content_type varchar(100),
    ADD COLUMN avatar_key varchar(36);

CREATE UNIQUE INDEX uk_users_avatar_key
    ON users (avatar_key)
    WHERE avatar_key IS NOT NULL;
