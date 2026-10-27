CREATE TABLE actors (
 id TEXT PRIMARY KEY, campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
 name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('character','npc')), asset_id TEXT NOT NULL,
 biography TEXT NOT NULL DEFAULT '', dm_notes TEXT NOT NULL DEFAULT '',
 hp INTEGER NOT NULL CHECK(hp BETWEEN 0 AND 1000000),
 max_hp INTEGER NOT NULL CHECK(max_hp BETWEEN 1 AND 1000000 AND hp<=max_hp),
 attributes TEXT NOT NULL DEFAULT '{}', visibility TEXT NOT NULL DEFAULT 'dm' CHECK(visibility IN ('dm','shared')),
 version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, UNIQUE(id,campaign_id)
);
CREATE TABLE actor_ownership (
 actor_id TEXT NOT NULL,campaign_id TEXT NOT NULL,user_id TEXT NOT NULL,
 permission TEXT NOT NULL CHECK(permission IN ('observer','owner')),PRIMARY KEY(actor_id,user_id),
 FOREIGN KEY(actor_id,campaign_id) REFERENCES actors(id,campaign_id) ON DELETE CASCADE,
 FOREIGN KEY(campaign_id,user_id) REFERENCES memberships(campaign_id,user_id) ON DELETE CASCADE
);
ALTER TABLE tokens ADD COLUMN actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL;
