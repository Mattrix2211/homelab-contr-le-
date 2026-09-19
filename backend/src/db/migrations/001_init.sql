-- Core cockpit database: config, users, audit log, cockpit-native events.
-- Time-series metrics stay in Prometheus (section 38) - never duplicated here.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('viewer', 'operator', 'admin')),
  display_name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_display_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  params TEXT, -- JSON, non-sensitive only
  result TEXT NOT NULL CHECK (result IN ('success', 'error', 'denied')),
  error TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('alert', 'system', 'action')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT, -- JSON
  active INTEGER NOT NULL DEFAULT 1, -- for alerts: still ongoing
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(active);

CREATE TABLE IF NOT EXISTS quick_actions (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  action_key TEXT NOT NULL, -- maps to an action engine handler
  target TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS integrations_config (
  key TEXT PRIMARY KEY, -- e.g. 'proxmox', 'prometheus'
  enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}', -- JSON, secrets excluded (env-only)
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  csrf_token TEXT NOT NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
