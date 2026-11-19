ALTER TABLE subs ADD COLUMN p256dh TEXT;
--> statement-breakpoint
ALTER TABLE subs ADD COLUMN auth TEXT;
--> statement-breakpoint
CREATE TABLE announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, last_row INTEGER NOT NULL);
