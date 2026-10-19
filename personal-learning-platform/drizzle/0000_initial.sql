PRAGMA foreign_keys=ON;
--> statement-breakpoint
CREATE TABLE user (id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,emailVerified INTEGER NOT NULL DEFAULT 0,image TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE session(id TEXT PRIMARY KEY,expiresAt INTEGER NOT NULL,token TEXT NOT NULL UNIQUE,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL,ipAddress TEXT,userAgent TEXT,userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE);
--> statement-breakpoint
CREATE INDEX session_user ON session(userId);
--> statement-breakpoint
CREATE TABLE account(id TEXT PRIMARY KEY,accountId TEXT NOT NULL,providerId TEXT NOT NULL,userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,accessToken TEXT,refreshToken TEXT,idToken TEXT,accessTokenExpiresAt INTEGER,refreshTokenExpiresAt INTEGER,scope TEXT,password TEXT,createdAt INTEGER NOT NULL,updatedAt INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX account_user ON account(userId);
--> statement-breakpoint
CREATE TABLE verification(id TEXT PRIMARY KEY,identifier TEXT NOT NULL,value TEXT NOT NULL,expiresAt INTEGER NOT NULL,createdAt INTEGER,updatedAt INTEGER);
--> statement-breakpoint
CREATE INDEX verification_identifier ON verification(identifier);
--> statement-breakpoint
CREATE TABLE profiles(user_id TEXT PRIMARY KEY,email TEXT NOT NULL,name TEXT NOT NULL,timezone TEXT NOT NULL DEFAULT 'Asia/Singapore',language TEXT NOT NULL DEFAULT 'zh',preferences TEXT NOT NULL DEFAULT '{}',reminders TEXT NOT NULL DEFAULT '{"enabled":false,"time":"19:00","timezone":"Asia/Singapore","email":false,"push":false,"quietStart":"22:00","quietEnd":"08:00","weeklyGoal":5}',created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE courses(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT NOT NULL,goal TEXT NOT NULL,language TEXT NOT NULL,strategy TEXT NOT NULL,exam_date TEXT,concepts TEXT NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,last_event TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX courses_owner ON courses(user_id,updated_at);
--> statement-breakpoint
CREATE TABLE events(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,concept_id TEXT NOT NULL,attempt_id TEXT NOT NULL,event TEXT NOT NULL,occurred_at TEXT NOT NULL,UNIQUE(user_id,attempt_id));
--> statement-breakpoint
CREATE INDEX events_course ON events(user_id,course_id,occurred_at);
--> statement-breakpoint
CREATE TABLE materials(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,name TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,pages INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL,error TEXT,object_key TEXT NOT NULL,normalized_key TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX materials_owner ON materials(user_id,course_id,status);
--> statement-breakpoint
CREATE TABLE sources(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,material_id TEXT,title TEXT NOT NULL,page INTEGER,url TEXT,content TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX sources_course ON sources(user_id,course_id,material_id);
--> statement-breakpoint
CREATE VIRTUAL TABLE source_search USING fts5(source_id UNINDEXED,course_id UNINDEXED,user_id UNINDEXED,content,tokenize='unicode61');
--> statement-breakpoint
CREATE TABLE lessons(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,concept_id TEXT NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX lessons_owner ON lessons(user_id,course_id,concept_id);
--> statement-breakpoint
CREATE TABLE messages(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,concept_id TEXT,role TEXT NOT NULL,content TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX messages_course ON messages(user_id,course_id,created_at);
--> statement-breakpoint
CREATE TABLE assessments(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL,concept_id TEXT NOT NULL,card TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX assessments_course ON assessments(user_id,course_id);
--> statement-breakpoint
CREATE TABLE notes(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,concept_id TEXT,title TEXT NOT NULL,body TEXT NOT NULL,updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX notes_owner ON notes(user_id,course_id);
--> statement-breakpoint
CREATE TABLE activities(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT,concept_id TEXT,kind TEXT NOT NULL,day TEXT NOT NULL,xp INTEGER NOT NULL,coins INTEGER NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX activities_user ON activities(user_id,day);
--> statement-breakpoint
CREATE TABLE purchases(user_id TEXT NOT NULL,item TEXT NOT NULL,price INTEGER NOT NULL,created_at TEXT NOT NULL,PRIMARY KEY(user_id,item));
--> statement-breakpoint
CREATE TABLE budgets(month TEXT NOT NULL,bucket TEXT NOT NULL,spent INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL DEFAULT 0,limit_fen INTEGER NOT NULL,PRIMARY KEY(month,bucket));
--> statement-breakpoint
CREATE TABLE reservations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,day TEXT NOT NULL,month TEXT NOT NULL,bucket TEXT NOT NULL,status TEXT NOT NULL,reserved_fen INTEGER NOT NULL,actual_fen INTEGER NOT NULL DEFAULT 0,input_tokens INTEGER NOT NULL DEFAULT 0,output_tokens INTEGER NOT NULL DEFAULT 0,asr_seconds REAL NOT NULL DEFAULT 0,tts_characters INTEGER NOT NULL DEFAULT 0,pages INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,completed_at TEXT);
--> statement-breakpoint
CREATE INDEX reservations_user ON reservations(user_id,day,status);
--> statement-breakpoint
CREATE INDEX reservations_month ON reservations(month,bucket,status);
--> statement-breakpoint
CREATE TABLE jobs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,error TEXT,next_run TEXT NOT NULL,lease_until TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX jobs_due ON jobs(status,next_run);
--> statement-breakpoint
CREATE TABLE push_subscriptions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,subscription TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX push_user ON push_subscriptions(user_id);
--> statement-breakpoint
CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,url TEXT NOT NULL,is_read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE INDEX notifications_user ON notifications(user_id,created_at);
--> statement-breakpoint
CREATE TABLE deliveries(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,day TEXT NOT NULL,channel TEXT NOT NULL,status TEXT NOT NULL,error TEXT,created_at TEXT NOT NULL,UNIQUE(user_id,day,channel));
--> statement-breakpoint
CREATE TABLE feedback(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,course_id TEXT,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE audit_log(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE settings(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);