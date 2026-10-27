ALTER TABLE campaigns ADD COLUMN revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0);
CREATE TABLE token_controllers (
    token_id TEXT PRIMARY KEY REFERENCES tokens(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE command_receipts (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(campaign_id, user_id, request_id)
);
CREATE TABLE campaign_events (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL,
    event_id TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY(campaign_id, revision)
);
CREATE INDEX receipts_age ON command_receipts(created_at);
