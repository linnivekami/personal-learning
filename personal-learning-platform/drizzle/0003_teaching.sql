CREATE TABLE teaching_decisions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,concept_id TEXT NOT NULL,decision TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX decisions_course ON teaching_decisions(user_id,course_id,created_at);