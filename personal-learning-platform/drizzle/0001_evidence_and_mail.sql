ALTER TABLE courses ADD COLUMN legacy_data TEXT NOT NULL DEFAULT '{}';
--> statement-breakpoint
ALTER TABLE assessments ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE mail_deliveries(id TEXT PRIMARY KEY,email TEXT NOT NULL,day TEXT NOT NULL,status TEXT NOT NULL,error TEXT,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX mail_day ON mail_deliveries(day,status);