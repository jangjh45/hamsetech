-- JWT token_version now records the authentication generation captured by
-- server-side sessions. Preserve existing values during the rename.
ALTER TABLE users RENAME COLUMN token_version TO auth_version;
