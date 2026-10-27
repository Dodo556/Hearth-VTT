-- Extend scopes while preserving every old ID, nonce and immutable JSON byte.
CREATE TABLE dice_rolls_next (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    roller_user_id TEXT NOT NULL REFERENCES users(id),
    visibility TEXT NOT NULL CHECK(visibility IN ('public','gm','self','blind','selected')),
    revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    ast_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    client_roll_id TEXT NOT NULL DEFAULT '',
    UNIQUE(campaign_id,revision)
);
INSERT INTO dice_rolls_next SELECT id,campaign_id,roller_user_id,visibility,revision,created_at,ast_json,result_json,client_roll_id FROM dice_rolls;
DROP TABLE dice_rolls;
ALTER TABLE dice_rolls_next RENAME TO dice_rolls;
CREATE INDEX dice_history ON dice_rolls(campaign_id,revision DESC);
CREATE INDEX dice_rate ON dice_rolls(campaign_id,roller_user_id,created_at);
CREATE UNIQUE INDEX dice_client_ids ON dice_rolls(campaign_id,roller_user_id,client_roll_id);
CREATE TABLE dice_recipients (
    roll_id TEXT NOT NULL REFERENCES dice_rolls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY(roll_id,user_id)
);
CREATE TABLE chat_messages (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_user_id TEXT NOT NULL REFERENCES users(id),
    client_message_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    body TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('public','whisper')),
    created_at INTEGER NOT NULL,
    revision INTEGER NOT NULL,
    UNIQUE(campaign_id,sender_user_id,client_message_id),
    UNIQUE(campaign_id,revision)
);
CREATE INDEX chat_history ON chat_messages(campaign_id,revision DESC);
CREATE TABLE chat_recipients (
    message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY(message_id,user_id)
);
-- Independent of history pruning; membership deletion revokes an active budget.
CREATE TABLE chat_rate (
    message_id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    client_message_id TEXT NOT NULL,
    accepted_at_ms INTEGER NOT NULL,
    FOREIGN KEY(campaign_id,user_id) REFERENCES memberships(campaign_id,user_id) ON DELETE CASCADE,
    UNIQUE(campaign_id,user_id,client_message_id)
);
CREATE INDEX chat_rate_window ON chat_rate(campaign_id,user_id,accepted_at_ms);
CREATE INDEX chat_rate_age ON chat_rate(accepted_at_ms);
