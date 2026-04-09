-- God posts: what kind of item + who it is for (logged on events row)

ALTER TABLE events ADD COLUMN IF NOT EXISTS content_kind TEXT NOT NULL DEFAULT 'event';
ALTER TABLE events ADD COLUMN IF NOT EXISTS audience_scope TEXT;

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_content_kind_check;
ALTER TABLE events ADD CONSTRAINT events_content_kind_check
  CHECK (content_kind IN ('event', 'club_info', 'opportunity'));

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_audience_scope_check;
ALTER TABLE events ADD CONSTRAINT events_audience_scope_check
  CHECK (audience_scope IS NULL OR audience_scope IN ('clubs', 'admin', 'general'));

COMMENT ON COLUMN events.content_kind IS 'event | club_info | opportunity — god-classified post type';
COMMENT ON COLUMN events.audience_scope IS 'clubs | admin | general — who this is for (god posts); NULL for normal club posts';
