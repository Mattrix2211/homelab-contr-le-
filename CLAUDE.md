# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

MK HomeLab Control Center: a personal cockpit for a home lab (Proxmox host,
TrueNAS NAS, Raspberry Pi running Home Assistant, and a Docker LXC running
Portainer/AdGuard/Frigate/Prometheus/Grafana/etc.). It aggregates state from
these systems into one dark, keyboard-first UI — it does not replace
Grafana/Proxmox/Portainer/TrueNAS/Home Assistant, it sits above them.
Implements the full spec (Phase 1 + 2 + 3) — see `docs/SPEC.md` (full
original spec, sections 1-47) and `docs/ARCHITECTURE.md` (technical
decisions, the exact assumptions behind each Phase 2 integration's API
shape, and the concrete interpretation chosen for open-ended Phase 3 items
like "automatisations" and "détection d'anomalies" — read this before
making architectural changes).

## Commands

Backend (`backend/`):
```bash
npm install
npm run dev         # tsx watch, http://localhost:4000
npm run build        # tsc -> dist/
npm run typecheck    # tsc --noEmit
npm start             # run dist/index.js (after build)
```

Frontend (`frontend/`):
```bash
npm install
npm run dev          # vite, http://localhost:5173, proxies /api and /ws to :4000
npm run build         # tsc -b && vite build -> dist/
npm run typecheck     # tsc --noEmit -p tsconfig.json
npm run preview        # serve the production build locally
```

There is no test suite in either package yet (no `test` script, no test
runner installed). Both `dev` scripts require environment variables
(`JWT_SECRET`, `ADMIN_PASSWORD` at minimum for the backend) — see
`.env.example` at the repo root and copy/export what you need, or run
everything via `docker compose up -d` after `cp .env.example .env`.

Full stack via Docker (from repo root):
```bash
cp .env.example .env   # edit JWT_SECRET, ADMIN_PASSWORD, integrations
docker compose up -d
```
`backend` mounts `/var/run/docker.sock` read-write (only into that
container — never the frontend) and a named volume for the SQLite file at
`/data`. `frontend` is nginx serving the built SPA and reverse-proxying
`/api` and `/ws` to `backend`.

## Architecture

Two independent npm packages, no shared code between them (types are
hand-duplicated in `frontend/src/api/types.ts` to mirror
`backend/src/types.ts` — keep them in sync manually when changing the API
shape).

### Backend (`backend/src/`)

Plain Express + `better-sqlite3`, no ORM, no framework beyond that.
Everything flows through:

- **`config/env.ts`** — all environment variables, with every integration
  optional (`*_ENABLED` flags) and defaulted so the app runs with just
  Docker enabled.
- **`config/registry.ts`** — the static topology (hosts + services +
  which Docker container names map to which service). This is the source
  of truth for what the Cockpit/Infrastructure/Services pages render;
  extend it here when adding a new host or service rather than
  hardcoding it in a route.
- **`integrations/*.ts`** — one adapter per external system (docker,
  proxmox, prometheus, homeassistant, truenas, adguard, npm, wireguard,
  frigate, zigbee2mqtt, dockerRegistry, notifications). Each exposes an
  `*Available()` check and a `*LastError()` getter, and **never throws**
  out of a monitoring call — failures return `null`/`[]` so one dead
  integration doesn't take down the cockpit. Follow this pattern for any
  new integration. Several of these (TrueNAS's exact REST paths, wg-easy,
  Zigbee2MQTT's optional HTTP API) rest on a documented convention rather
  than a live-tested instance — see `docs/ARCHITECTURE.md`'s "Phase 2/3
  implementation notes" before assuming a call shape is wrong.
- **`engines/monitoring.ts`** — polls all integrations on an interval
  (`startMonitoringLoop`, ~10s), builds a single in-memory `Snapshot`
  (`getSnapshot()`), and reconciles alerts into the `events` table,
  including the System Map rollup (a downed host or dead Docker daemon
  collapses its dependent services into one alert instead of many —
  `setAlertListener()` is how the notification engine hears about new
  alerts without monitoring.ts depending on it). REST routes read from this
  cache rather than hitting integrations directly.
- **`engines/actions.ts`** — the single choke point for every mutating
  action. `ACTIONS` maps an action key to `{ level, minRole }` (levels 1-3
  match `docs/SPEC.md` section 21: level 1 = immediate, level 2 = confirm,
  level 3 = destructive and **intentionally never wired to a handler
  here** — those stay behind "Open native UI" links only). `runAction()`
  checks the role, runs the integration call, and always writes one
  `audit_log` row and one `events` row. Any new mutation must go through
  this, not call an integration directly from a route. `RunActionContext.
  userId` is nullable specifically so `engines/automation.ts` can attribute
  a rule-triggered run without a signed-in user.
- **`engines/automation.ts`** — evaluates enabled `automation_rules` every
  30s against the monitoring snapshot (in-memory `downSince` map tracks how
  long a condition has been true; resets on restart, which is an accepted
  tradeoff for a home lab); fires through `runAction()` with a per-rule
  cooldown. Only level 1/2 action keys are dispatchable.
- **`engines/updates.ts`** — background Docker Hub digest check on its own
  interval (`UPDATE_CHECK_INTERVAL_MINUTES`, not the 10s loop, since it's
  network-heavy); cached and read by `routes/updates.ts`.
- **`db/`** — `client.ts` opens the SQLite file (WAL mode) and runs
  `migrations/*.sql` in order on boot (tracked in `_migrations`); add a new
  numbered `.sql` file for schema changes, never edit an applied one.
  `repo.ts` holds all hand-written prepared-statement queries. Per
  `docs/ARCHITECTURE.md`, this DB is for config/users/audit/events/backups/
  automation_rules/notification_channels/user_preferences only — time-series
  metrics stay in Prometheus, never get duplicated here.
- **`routes/*.ts`** — thin: parse/validate with `zod`, call an engine or
  integration, return JSON. Auth (`requireAuth`) and role checks
  (`requireRole`) are applied per-router in `index.ts`, not inside routes.
- **`ws/index.ts`** — authenticates the WebSocket handshake against the
  same session cookie as REST, then broadcasts every monitoring snapshot.
- **`middleware/auth.ts`** — session model: an httpOnly JWT cookie holding
  only a session id (actual expiry/CSRF token lives in the `sessions`
  table, so logout is immediate rather than waiting out a JWT TTL); CSRF is
  double-submit via an `x-csrf-token` header checked against the session
  row on every mutating request.

### Frontend (`frontend/src/`)

React + Vite + TypeScript, TanStack Query for server state, plain CSS (no
Tailwind/UI framework) built on MK Design System v2.0 tokens.

- **`styles/tokens.css`** — the MK Design System v2.0 color/font/spacing
  tokens (dark-only for this HomeLab declination). Never hardcode colors —
  use the CSS custom properties. Fonts: Space Grotesk (display), Inter
  (body), JetBrains Mono (all technical/numeric data — IPs, percentages,
  temps, uptimes).
- **`styles/global.css`** — every component class (`.card`, `.status-badge`,
  `.drawer`, `.modal`, `.palette`, etc.). Components are styled by class
  name here, not with CSS-in-JS or modules.
- **`api/client.ts`** + **`api/hooks.ts`** — thin fetch wrapper
  (auto-attaches the CSRF token to mutating requests) and one TanStack
  Query hook per backend endpoint. Add new endpoints here, not with ad-hoc
  `fetch` calls in components.
- **`api/hooks.ts` → `useLiveSnapshot()`** — subscribes to `/ws` and writes
  pushed snapshots directly into the query cache for `hosts`/`services`/
  `containers`, so pages update without polling; REST `refetchInterval` is
  just the fallback if the socket drops.
- **`store/auth.tsx`**, **`store/toast.tsx`** — the only two React
  contexts. Auth holds the current user + CSRF token; there is no separate
  state library.
- **`components/ActionButton.tsx`** — the frontend half of the
  confirmation-level model: level 1 runs immediately, level ≥2 opens
  `ConfirmModal` first. Use this for any new mutating UI action rather than
  a bare button + fetch.
- **`components/AppShell.tsx`** — layout root (Sidebar + TopBar + routed
  page), owns the Ctrl+K command palette shortcut and mounts
  `useLiveSnapshot()` once.
- **`pages/`** — one file per sidebar page (Cockpit, Infrastructure,
  Services, Storage, Network, HomeAssistant, Monitoring, Events,
  Administration). When an integration a section needs isn't configured,
  the page shows an `EmptyState` naming the env vars to set rather than
  faking data — follow that pattern (not a placeholder that pretends the
  feature doesn't exist) for any new integration-backed section.
- **`pages/Cockpit.tsx`** — sections are data-driven (`DEFAULT_SECTIONS` +
  `sectionElements` record) specifically so per-user layout customization
  (`useCockpitLayout`/`useSetCockpitLayout`, backed by
  `user_preferences.cockpit_layout`) can reorder/hide them; add a new
  cockpit section there, not as an unconditionally-rendered block.

### Cross-cutting conventions

- Every status value is one of `online | degraded | warning | offline |
  unknown` (`Status` type, both sides). `unknown` means "integration not
  configured or unreachable" (with `unavailableReason` set) — distinct from
  `offline`, which means the integration successfully reports the
  thing is down. Preserve this distinction; don't collapse them.
- Secrets (Proxmox token, Home Assistant long-lived token, TrueNAS API key,
  Docker socket) only ever live in the backend process/env. The frontend
  never receives them — `routes/config.ts` returns booleans/"configured"
  only. Non-secret "open native UI" URLs are the one exception
  (`config/env.ts` → `env.links`, `routes/links.ts`) and are safe to expose
  as-is.
