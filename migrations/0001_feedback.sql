CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  content_hash TEXT NOT NULL,
  chapter_slug TEXT NOT NULL,
  chapter_title TEXT NOT NULL,
  section TEXT NOT NULL,
  pdf_pages TEXT NOT NULL,
  page_anchor TEXT NOT NULL,
  handout_version TEXT NOT NULL,
  site_version TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  description TEXT NOT NULL,
  suggestion TEXT NOT NULL,
  error_type TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  client_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'synced')),
  issue_number INTEGER,
  issue_url TEXT,
  synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS feedback_pending ON feedback(status, created_at);
CREATE INDEX IF NOT EXISTS feedback_rate ON feedback(client_hash, created_at);
