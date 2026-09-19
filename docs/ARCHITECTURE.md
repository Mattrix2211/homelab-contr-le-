# Architecture

This document explains how the codebase maps to `SPEC.md`, and the
technical decisions behind the implementation — Phase 1 (MVP) is fully
implemented, and Phase 2/3 are implemented as described below.

## Runtime topology

```
Browser (React SPA, served by nginx)
   │  HTTPS/WS (same-origin, nginx proxies /api and /ws)
   ▼
backend (Node/Express, container "backend")
   ├── Monitoring Engine  (engines/monitoring.ts)  — polls integrations every 10s,
   │                                                  builds a single Snapshot,
   │                                                  reconciles alerts
   ├── Action Engine      (engines/actions.ts)     — role + confirmation-level
   │                                                  gate for every mutation,
   │                                                  writes audit_log + events
   ├── Integration Layer  (integrations/*.ts)      — one adapter per external
   │                                                  system, each independently
   │                                                  optional and fail-soft
   ├── Updates Engine     (engines/updates.ts)      — background Docker Hub
   │                                                  digest check, own cadence
   ├── Automation Engine  (engines/automation.ts)   — evaluates automation_rules
   │                                                  against the snapshot, calls
   │                                                  the action engine
   └── SQLite (better-sqlite3, WAL mode, /data volume)
        users · sessions · audit_log · events · quick_actions · integrations_config
        backups · automation_rules · notification_channels · user_preferences
   │
   └── WebSocket (ws/index.ts) — pushes the Snapshot to authenticated clients
```

Only the backend ever holds credentials or talks to `/var/run/docker.sock`,
Proxmox tokens, Home Assistant long-lived tokens, or TrueNAS API keys
(section 28). The frontend only ever calls `/api/*` and `/ws` on its own
origin.

## Why SQLite instead of Postgres

Section 38 explicitly scopes the cockpit's own DB to configuration, users,
audit log and cockpit-native events — never time-series metrics (that stays
in Prometheus). That's a small, single-writer workload well within SQLite's
sweet spot, and it removes an entire container + network dependency from
`docker compose up -d`, which matches section 4's "aucune dépendance
manuelle sur l'hôte." Migrations are plain, ordered `.sql` files applied
once on boot (`db/migrations/`, tracked in a `_migrations` table) rather
than a heavier migration framework.

## Why no ORM

The schema is small (6 tables) and the query patterns are simple CRUD +
a handful of aggregate reads. Hand-written parameterized SQL via
`better-sqlite3`'s prepared statements is fewer moving parts than an ORM,
and keeps every query auditable in `db/repo.ts`.

## Graceful degradation (section 30)

Every integration adapter (`integrations/docker.ts`, `proxmox.ts`,
`prometheus.ts`, `homeassistant.ts`, `truenas.ts`) exposes an `*Available()`
check and never throws out of the monitoring loop — a failed call returns
`null`/`[]` and records a `lastError`, and the monitoring engine renders
that as host/service `status: "unknown"` with an `unavailableReason`
string, distinct from `offline` (a service that *is* reachable and reports
down). This is what keeps one bad integration from failing the whole
cockpit.

## Action engine & confirmation levels (section 21)

`engines/actions.ts` defines every mutating action the cockpit exposes as a
`{ key, label, level, minRole }` tuple. `runAction()` is the single choke
point: it checks the caller's role against `minRole`, executes the
integration call, and always writes one `audit_log` row and one `events`
row (success or failure). Level 3 (critical/destructive — host shutdown,
pool deletion, etc.) is **not implemented** anywhere as a callable action;
per the spec, those stay behind "Open native UI" links only. The frontend's
`ActionButton` component mirrors the same three levels: level 1 runs
immediately, level 2+ requires the `ConfirmModal`.

## Live updates (section 31)

Rather than have every page poll every integration, the monitoring engine
polls once every ~10s and the result is:
1. cached in memory (`getSnapshot()`) so any REST request is instant,
2. pushed to every authenticated WebSocket client.

The frontend's `useLiveSnapshot()` hook writes pushed snapshots straight
into the TanStack Query cache, so `useHosts()` / `useServices()` /
`useContainers()` update without an extra round trip. REST polling
(`refetchInterval`) stays as a fallback if the socket drops.

## Auth model (sections 26-27)

- Password hashing: bcrypt.
- Session: opaque session id in an httpOnly, `SameSite=Lax` cookie, signed
  as a JWT purely so the cookie is tamper-evident; the actual session state
  (expiry, CSRF token) lives server-side in the `sessions` table, so
  logout/expiry is immediate rather than waiting out a JWT TTL.
- CSRF: double-submit — the CSRF token issued at login must be echoed in an
  `x-csrf-token` header on every mutating request; it's checked against the
  session row.
- Rate limiting: `express-rate-limit` on `/api/auth/login` (10 attempts /
  15 min) and a general 300 req/min cap on `/api`.
- Roles: `viewer < operator < admin`, enforced both in `middleware/auth.ts`
  (`requireRole`) and again inside the action engine.

## Phase 2/3 implementation notes

Everything in `SPEC.md` sections 43-44 is implemented. A few integrations
rest on a documented convention rather than a live-tested API (no real
TrueNAS/AdGuard/NPM/wg-easy instance was available while building this), so
they're flagged here with the assumption made — check these first if an
integration doesn't come up cleanly against your version:

- **TrueNAS** (`integrations/truenas.ts`) — pools/disks/datasets/snapshots
  and SMART/scrub triggers follow TrueNAS SCALE's documented REST
  convention (`/api/v2.0/<service>/<method>`, e.g. `pool.scrub` on pool id
  1 → `POST /api/v2.0/pool/id/1/scrub`). Adjust paths if your version
  differs.
- **AdGuard Home** (`integrations/adguard.ts`) — session login via
  `POST /control/login`, re-authenticates on a 403. Works without
  `ADGUARD_USERNAME`/`PASSWORD` set if AdGuard itself has no auth
  configured.
- **Nginx Proxy Manager** (`integrations/npm.ts`) — token auth via
  `POST /api/tokens`, cached and refreshed before expiry.
- **WireGuard** (`integrations/wireguard.ts`) — targets **wg-easy**
  specifically (the most common self-hosted WireGuard UI with an actual
  REST API); a plain `wg-quick` setup has no HTTP API and will just show
  "not configured".
- **Zigbee2MQTT** (`integrations/zigbee2mqtt.ts`) — best-effort only
  (section 16 itself says "éventuellement"). Zigbee2MQTT is primarily an
  MQTT service; this calls its optional HTTP frontend's `/api/devices`,
  which isn't present on every install. A failure here never marks
  Zigbee2MQTT itself down, it just hides the device count.
- **Docker Hub update checks** (`integrations/dockerRegistry.ts`,
  `engines/updates.ts`) — compares the locally pulled image's
  `RepoDigest` against the registry's current manifest digest via Docker
  Hub's anonymous token flow. Only Docker Hub is supported; images from
  `ghcr.io`, `lscr.io`, private registries, etc. report
  `updateAvailable: null` ("undetermined") rather than a guess. Runs on
  its own interval (`UPDATE_CHECK_INTERVAL_MINUTES`, default 60), not the
  10s monitoring loop, since digest lookups are network-heavy.
- **Frigate** (`integrations/frigate.ts`) — uses Frigate's stable
  `/api/config`, `/api/stats`, `/api/events` endpoints; a camera is
  considered online if it has a current entry in `/api/stats`.

### Open-ended Phase 3 items: the interpretation used

Two Phase 3 bullets in section 44 ("détection d'anomalies",
"automatisations") and one in section 25 ("notification mobile") are
intentionally not specified further in the brief. Rather than build
something speculative, each got a concrete, bounded reading:

- **"Détection d'anomalies"** → the existing threshold-based alerts
  (offline/degraded status, RAM/CPU thresholds already in the Cockpit) plus
  the automation engine's remediation rules **are** the anomaly response
  here. No separate statistical/ML anomaly detector was built — nothing in
  the spec described what "anomalous" should mean beyond the thresholds
  already covered by section 6's alert zone.
- **"Automatisations"** → `engines/automation.ts` implements one concrete
  rule shape: *"if `<service|host>` stays down for N minutes, run
  `<existing level 1/2 action>`, then wait a cooldown before it can fire
  again."* Rules are CRUD-managed in Administration, evaluated every 30s
  against the same snapshot the monitoring engine already builds. Level 3
  (destructive) actions are structurally impossible to select as an
  automation's action (`ACTIONS` only carries level 1/2 entries), matching
  section 21's "certaines actions ne doivent simplement pas être
  implémentées."
- **"Notification mobile"** (section 25) → rather than build push
  infrastructure the spec never asked for a provider for, this routes
  through Home Assistant's own `notify.<service>` (e.g.
  `notify.mobile_app_matthis_phone`), since a real Home Assistant instance
  in this HomeLab already has the official mobile app / push notifications
  configured. Discord covers the other channel named in the same section.

### System Map correlation (section 40)

`engines/monitoring.ts`'s `reconcileAlerts()` tracks which hosts are down
and, separately, whether the Docker daemon on the LXC host is unreachable
while the host itself is up. Either condition suppresses the individual
per-service alerts for everything hosted there and replaces them with one
alert naming the affected services (`"M83 is offline — 5 dependent
service(s) affected: AdGuard, NPM, Frigate, Prometheus, Grafana"`). This is
list-based correlation against the static `config/registry.ts` topology,
not a general dependency-graph solver — sufficient for this HomeLab's
depth (one Docker host, one NAS, one Pi) without over-building for a
topology that doesn't exist here.
