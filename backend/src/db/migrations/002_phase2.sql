-- Phase 2/3 additions: backups tracking (section 12), automation rules
-- (section 44), notification channels (section 25/44), and per-user
-- dashboard preferences (section 44). Everything else in Phase 2/3 reads
-- live from an integration and is never persisted here (section 38).

CREATE TABLE IF NOT EXISTS backups (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('homeassistant', 'truenas-snapshot', 'custom')),
  target_ref TEXT, -- e.g. TrueNAS dataset path or periodic snapshot task id
  trigger_url TEXT, -- optional webhook for a 'custom' backup runner
  last_run_at TEXT,
  last_status TEXT CHECK (last_status IN ('success', 'error', 'running')),
  last_duration_ms INTEGER,
  last_size_bytes INTEGER,
  last_error TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('service_down', 'host_down')),
  trigger_target TEXT NOT NULL, -- service id or host id
  trigger_minutes INTEGER NOT NULL DEFAULT 5, -- sustained duration before firing
  action_key TEXT NOT NULL, -- e.g. container.restart / guest.reboot
  action_target TEXT NOT NULL, -- container id / vmid / guest ref
  cooldown_minutes INTEGER NOT NULL DEFAULT 30,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_triggered_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notification_channels (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('discord', 'homeassistant')),
  -- discord: incoming webhook URL. homeassistant: notify service suffix
  -- (e.g. "mobile_app_matthis_phone" -> notify.mobile_app_matthis_phone).
  target TEXT NOT NULL,
  min_severity TEXT NOT NULL DEFAULT 'warning' CHECK (min_severity IN ('info', 'warning', 'critical')),
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  cockpit_layout TEXT, -- JSON: [{ id, visible }]
  notifications_last_seen_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
