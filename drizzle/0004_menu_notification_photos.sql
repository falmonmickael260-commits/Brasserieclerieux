CREATE TABLE menu_notification_photos (
  day TEXT NOT NULL,
  notification_key TEXT NOT NULL,
  photo TEXT NOT NULL,
  PRIMARY KEY (day, notification_key)
);
--> statement-breakpoint
CREATE TRIGGER keep_previous_notification_photo
BEFORE UPDATE OF notification_key ON menus
WHEN OLD.state = 'published' AND OLD.photo IS NOT NULL
  AND COALESCE(OLD.notification_key, OLD.day) <> COALESCE(NEW.notification_key, NEW.day)
BEGIN
  INSERT OR IGNORE INTO menu_notification_photos (day, notification_key, photo)
    VALUES (OLD.day, COALESCE(OLD.notification_key, OLD.day), OLD.photo);
  DELETE FROM menu_notification_photos WHERE day < date(NEW.day, '-7 days');
END;
