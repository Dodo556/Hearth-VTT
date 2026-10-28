ALTER TABLE drawings ADD COLUMN font_size INTEGER NOT NULL DEFAULT 24 CHECK(font_size BETWEEN 8 AND 96);
ALTER TABLE drawings ADD COLUMN text_fit INTEGER NOT NULL DEFAULT 1 CHECK(text_fit IN (0,1));
ALTER TABLE drawings ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0);
ALTER TABLE drawings ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
UPDATE drawings SET sort_order=rowid;
CREATE TABLE drawing_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    drawing_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('create','delete','update')),
    before_state TEXT CHECK(before_state IS NULL OR json_valid(before_state))
);
CREATE INDEX drawing_history_scene ON drawing_history(scene_id,id);
INSERT INTO drawing_history(scene_id,drawing_id,action)
SELECT scene_id,id,'create' FROM drawings ORDER BY rowid;
