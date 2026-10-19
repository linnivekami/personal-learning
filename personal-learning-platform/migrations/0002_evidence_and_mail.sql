ALTER TABLE courses ADD COLUMN legacy_data TEXT NOT NULL DEFAULT '{}';
ALTER TABLE assessments ADD COLUMN hints_used INTEGER NOT NULL DEFAULT 0;
CREATE TABLE mail_deliveries(id TEXT PRIMARY KEY,email TEXT NOT NULL,day TEXT NOT NULL,status TEXT NOT NULL,error TEXT,created_at TEXT NOT NULL);
CREATE INDEX mail_day ON mail_deliveries(day,status);
