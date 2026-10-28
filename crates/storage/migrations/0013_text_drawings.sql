CREATE TABLE drawings_next (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    shape TEXT NOT NULL CHECK(shape IN ('line','rectangle','freehand','text')),
    visibility TEXT NOT NULL CHECK(visibility IN ('shared','dm')),
    color TEXT NOT NULL,
    start_x REAL NOT NULL,
    start_y REAL NOT NULL,
    end_x REAL NOT NULL,
    end_y REAL NOT NULL,
    points TEXT NOT NULL DEFAULT '[]' CHECK(
        json_valid(points) AND json_type(points)='array' AND
        ((shape='freehand' AND json_array_length(points) BETWEEN 2 AND 128) OR
         (shape!='freehand' AND points='[]'))
    ),
    text TEXT CHECK(
        (shape='text' AND text IS NOT NULL AND length(text) BETWEEN 1 AND 120) OR
        (shape!='text' AND text IS NULL)
    )
);
INSERT INTO drawings_next(rowid,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points)
SELECT rowid,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y,points FROM drawings ORDER BY rowid;
DROP TABLE drawings;
ALTER TABLE drawings_next RENAME TO drawings;
CREATE INDEX drawings_scene ON drawings(scene_id);
