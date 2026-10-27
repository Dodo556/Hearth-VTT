CREATE TABLE drawings_next (
    id TEXT PRIMARY KEY,
    scene_id TEXT NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
    shape TEXT NOT NULL CHECK(shape IN ('line','rectangle','freehand')),
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
    )
);
INSERT INTO drawings_next(rowid,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y)
SELECT rowid,id,scene_id,shape,visibility,color,start_x,start_y,end_x,end_y FROM drawings ORDER BY rowid;
DROP TABLE drawings;
ALTER TABLE drawings_next RENAME TO drawings;
CREATE INDEX drawings_scene ON drawings(scene_id);
