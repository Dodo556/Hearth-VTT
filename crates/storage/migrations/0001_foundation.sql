CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_owner INTEGER NOT NULL DEFAULT 0 CHECK(is_owner IN (0, 1)),
    created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX one_owner ON users(is_owner) WHERE is_owner = 1;
CREATE TABLE host_profile (
    singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
    owner_id TEXT NOT NULL REFERENCES users(id),
    schema_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE device_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON device_sessions(expires_at);
CREATE TABLE campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0, 1)),
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);
CREATE TABLE memberships (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('dm', 'player')),
    created_at INTEGER NOT NULL,
    PRIMARY KEY(campaign_id, user_id)
);
CREATE TABLE invites (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL REFERENCES users(id),
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
);
CREATE TABLE scenes (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    width INTEGER NOT NULL CHECK(width > 0),
    height INTEGER NOT NULL CHECK(height > 0),
    grid_size INTEGER NOT NULL CHECK(grid_size > 0),
    background_asset_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);
CREATE TABLE tokens (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    x REAL NOT NULL,
    y REAL NOT NULL,
    size REAL NOT NULL CHECK(size > 0),
    color TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('shared', 'dm')),
    schema_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE journals (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    visibility TEXT NOT NULL CHECK(visibility IN ('shared', 'dm')),
    schema_version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);
