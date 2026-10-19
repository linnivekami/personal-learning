CREATE TABLE stored_objects(key TEXT PRIMARY KEY,user_id TEXT NOT NULL,material_id TEXT,size INTEGER NOT NULL,version TEXT NOT NULL,expires_at TEXT,created_at TEXT NOT NULL);
CREATE INDEX stored_objects_owner ON stored_objects(user_id);
