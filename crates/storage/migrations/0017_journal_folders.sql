CREATE TABLE journal_folders (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES journal_folders(id) ON DELETE SET NULL,
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 60),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9007199254740991),
    CHECK(parent_id IS NULL OR parent_id <> id)
);
CREATE INDEX journal_folders_campaign ON journal_folders(campaign_id);
ALTER TABLE journals ADD COLUMN folder_id TEXT REFERENCES journal_folders(id) ON DELETE SET NULL;
