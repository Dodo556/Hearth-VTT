CREATE TABLE dice_rolls (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    roller_user_id TEXT NOT NULL REFERENCES users(id),
    visibility TEXT NOT NULL CHECK(visibility IN ('public','gm','self','blind')),
    revision INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    ast_json TEXT NOT NULL,
    result_json TEXT NOT NULL,
    UNIQUE(campaign_id,revision)
);
CREATE INDEX dice_history ON dice_rolls(campaign_id,revision DESC);
CREATE INDEX dice_rate ON dice_rolls(campaign_id,roller_user_id,created_at);
-- Intentionally independent from history rows: pruning must not reset a budget.
CREATE TABLE dice_roll_rate (
    roll_id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    accepted_at INTEGER NOT NULL,
    FOREIGN KEY(campaign_id,user_id) REFERENCES memberships(campaign_id,user_id) ON DELETE CASCADE
);
CREATE INDEX dice_rate_window ON dice_roll_rate(campaign_id,user_id,accepted_at);
CREATE INDEX dice_rate_age ON dice_roll_rate(accepted_at);
