CREATE TABLE IF NOT EXISTS voice_sessions (
 id TEXT PRIMARY KEY,
 data TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_sessions_expiry ON voice_sessions(expires_at);
