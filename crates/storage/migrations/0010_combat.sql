CREATE TABLE combat_encounters (
    id TEXT PRIMARY KEY,
    campaign_id TEXT NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9007199254740991),
    status TEXT NOT NULL DEFAULT 'preparing' CHECK(status IN ('preparing','active','ended')),
    round INTEGER NOT NULL DEFAULT 0 CHECK(round BETWEEN 0 AND 1000000000),
    active_combatant_id TEXT,
    next_sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE combatants (
    id TEXT PRIMARY KEY,
    encounter_id TEXT NOT NULL REFERENCES combat_encounters(id) ON DELETE CASCADE,
    token_id TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1 CHECK(version BETWEEN 1 AND 9007199254740991),
    initiative INTEGER CHECK(initiative BETWEEN -1000 AND 1000),
    sort_order INTEGER NOT NULL,
    UNIQUE(encounter_id,token_id)
);
-- Nonces live in the caller/campaign namespace, never the host entity namespace.
CREATE TABLE combat_creation_nonces (
    campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('encounter','combatant')),
    nonce TEXT NOT NULL,
    PRIMARY KEY(campaign_id,user_id,kind,nonce)
);
-- Includes token cascades, so deleting a non-current entry also invalidates forms.
CREATE TRIGGER combatant_removed AFTER DELETE ON combatants BEGIN
    UPDATE combat_encounters SET version=version+1 WHERE id=OLD.encounter_id;
END;
