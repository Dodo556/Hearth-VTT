-- Existing text pages remain unchanged; uploads never grant access on their own.
ALTER TABLE journals ADD COLUMN asset_id TEXT REFERENCES assets(id) ON DELETE RESTRICT;
CREATE INDEX journals_asset ON journals(campaign_id, asset_id) WHERE asset_id IS NOT NULL;
