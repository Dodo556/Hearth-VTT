CREATE TABLE drawings (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    shape TEXT NOT NULL CHECK(shape IN ('line','rectangle')),
    visibility TEXT NOT NULL CHECK(visibility IN ('shared','dm')),
    color TEXT NOT NULL,
    start_x REAL NOT NULL,
    start_y REAL NOT NULL,
    end_x REAL NOT NULL,
    end_y REAL NOT NULL
);
CREATE INDEX drawings_scene ON drawings(scene_id);
CREATE TABLE drawing_creation_nonces (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nonce TEXT NOT NULL,
    PRIMARY KEY(campaign_id,user_id,nonce)
);
