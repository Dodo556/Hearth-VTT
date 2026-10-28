CREATE TABLE scene_notes (
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    visibility TEXT NOT NULL CHECK(visibility IN ('dm','shared')),
    body TEXT NOT NULL CHECK(length(body) <= 1000),
    version INTEGER NOT NULL CHECK(version > 0 AND version <= 9007199254740991),
    PRIMARY KEY(scene_id,visibility)
);
