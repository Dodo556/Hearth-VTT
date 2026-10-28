ALTER TABLE tokens ADD COLUMN vitals_version INTEGER NOT NULL DEFAULT 1 CHECK(vitals_version BETWEEN 1 AND 9007199254740991);
ALTER TABLE tokens ADD COLUMN hp INTEGER CHECK(hp IS NULL OR hp BETWEEN 0 AND 1000000);
ALTER TABLE tokens ADD COLUMN max_hp INTEGER CHECK((hp IS NULL AND max_hp IS NULL) OR (hp IS NOT NULL AND max_hp IS NOT NULL AND max_hp BETWEEN 1 AND 1000000 AND hp<=max_hp));
ALTER TABLE tokens ADD COLUMN hp_visibility TEXT NOT NULL DEFAULT 'controllers' CHECK(hp_visibility IN ('controllers','shared'));
ALTER TABLE tokens ADD COLUMN statuses TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(statuses) AND json_type(statuses)='array' AND json_array_length(statuses)<=6);
