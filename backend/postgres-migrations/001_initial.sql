CREATE SCHEMA IF NOT EXISTS together;
REVOKE ALL ON SCHEMA together FROM PUBLIC, anon, authenticated;
SET search_path TO together, pg_catalog;
CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password_hash TEXT NOT NULL,email_verified INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at BIGINT NOT NULL);
CREATE TABLE verifications(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at BIGINT NOT NULL);
CREATE TABLE albums(id TEXT PRIMARY KEY,title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('情侣','好友','旅行','日常')),owner_id TEXT NOT NULL REFERENCES users(id),updated_at TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
CREATE TABLE members(album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('owner','editor','viewer')),PRIMARY KEY(album_id,user_id));
CREATE TABLE photos(id TEXT PRIMARY KEY,album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES users(id),caption TEXT NOT NULL,date TEXT NOT NULL,mime TEXT NOT NULL,bytes BYTEA NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL);
CREATE TABLE favorites(photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,PRIMARY KEY(photo_id,user_id));
CREATE TABLE invitations(id TEXT PRIMARY KEY,album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,email TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('editor','viewer')),token_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL CHECK(status IN ('pending','accepted','revoked','expired')),expires_at BIGINT NOT NULL,created_at TEXT NOT NULL);
CREATE UNIQUE INDEX one_pending_invitation ON invitations(album_id,email) WHERE status='pending';
CREATE TABLE anniversaries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,title TEXT NOT NULL,date TEXT NOT NULL,emoji TEXT NOT NULL);
CREATE INDEX member_user ON members(user_id);
CREATE INDEX photo_album ON photos(album_id);
CREATE INDEX session_expiry ON sessions(expires_at);
CREATE TABLE password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE INDEX password_resets_user ON password_resets(user_id);

CREATE TABLE rate_limits(key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL);
REVOKE ALL ON ALL TABLES IN SCHEMA together FROM PUBLIC, anon, authenticated;
