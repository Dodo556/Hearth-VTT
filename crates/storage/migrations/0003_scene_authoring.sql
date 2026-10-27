ALTER TABLE campaigns ADD COLUMN active_scene_id TEXT REFERENCES scenes(id) ON DELETE SET NULL;
ALTER TABLE scenes ADD COLUMN visibility TEXT NOT NULL DEFAULT 'dm' CHECK(visibility IN ('shared','dm'));
UPDATE campaigns SET active_scene_id=(SELECT s.id FROM scenes s WHERE s.campaign_id=campaigns.id ORDER BY s.created_at,s.id LIMIT 1);
UPDATE scenes SET visibility='shared' WHERE id IN (SELECT active_scene_id FROM campaigns);
CREATE TABLE assets (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    sha256 TEXT NOT NULL,
    width INTEGER NOT NULL CHECK(width > 0),
    height INTEGER NOT NULL CHECK(height > 0),
    byte_size INTEGER NOT NULL CHECK(byte_size > 0),
    created_at INTEGER NOT NULL,
    UNIQUE(campaign_id,sha256)
);
