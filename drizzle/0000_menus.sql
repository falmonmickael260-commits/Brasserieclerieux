CREATE TABLE menus (day TEXT PRIMARY KEY, starter TEXT, main TEXT, sweet TEXT, price TEXT, state TEXT);
--> statement-breakpoint
CREATE TABLE subs (endpoint TEXT PRIMARY KEY);
--> statement-breakpoint
CREATE TABLE deliveries (day TEXT, endpoint TEXT, PRIMARY KEY(day,endpoint));
