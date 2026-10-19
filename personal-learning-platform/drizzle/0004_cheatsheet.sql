CREATE TABLE cheat_sheets(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,title TEXT NOT NULL,subtitle TEXT NOT NULL,scope TEXT NOT NULL,options TEXT NOT NULL,topics TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX cheat_sheets_course ON cheat_sheets(user_id,course_id,created_at);