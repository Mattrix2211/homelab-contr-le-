# Architecture

This document explains how the codebase maps to `SPEC.md`, and the
technical decisions behind the Phase 1 implementation.

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
   └── SQLite (better-sqlite3, WAL mode, /data volume)
        users · sessions · audit_log · events · quick_actions · integrations_config
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

## What's deferred to Phase 2/3

TrueNAS pool/dataset/SMART/snapshot detail, AdGuard query stats, NPM
certificate expiry, WireGuard peers, Frigate camera/event detail, the
System Map's automatic dependency-outage correlation, update detection, and
external notifications (Discord/mobile) are all stubbed with either a
working "overall health" adapter call or a clearly labeled placeholder
panel in the UI — see `SPEC.md` sections 43-44 for the full list. The data
model (`config/registry.ts`, `types.ts`) is already shaped to make these
additive rather than requiring a rewrite.
