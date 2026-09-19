# MK HomeLab Control Center

A personal cockpit for a home lab: **Monitor → Understand → Act**, from one
dark, keyboard-first interface. It does not replace Grafana, Proxmox,
Portainer, TrueNAS or Home Assistant — it sits above them, aggregating their
state and giving you the handful of safe actions you actually reach for day
to day, with a link out to the native UI for everything else.

This repository implements the full functional spec in `docs/SPEC.md`
(Phase 1 MVP, Phase 2 and Phase 3 — see `docs/ARCHITECTURE.md` for the
section-by-section implementation status and the reasoning behind a few
open-ended Phase 3 items).

## Stack

- **Backend** — Node.js 20, TypeScript, Express, SQLite (`better-sqlite3`),
  `ws` for live push updates. No ORM: plain SQL migrations run on boot.
- **Frontend** — React + TypeScript + Vite, TanStack Query, plain CSS built
  on MK Design System tokens (no UI framework).
- **Integrations** — Docker (`dockerode`), Proxmox VE (REST + token),
  Prometheus (query API), Home Assistant (REST), TrueNAS Scale (REST),
  AdGuard Home, Nginx Proxy Manager, WireGuard (via wg-easy), Frigate,
  Zigbee2MQTT (best-effort), Docker Hub (update checks), Discord webhooks.

Every integration is optional and degrades gracefully: if a service isn't
configured or unreachable, the cockpit shows `UNKNOWN` / "not configured"
instead of failing the whole page (section 30 of the spec).

## Quick start

```bash
cp .env.example .env
# edit .env: set JWT_SECRET, ADMIN_PASSWORD, and any integrations you have
docker compose up -d
```

Then open `http://localhost:8080` (or `WEB_PORT` if you changed it) and log
in with `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

The backend mounts `/var/run/docker.sock` read-write so it can list,
start/stop/restart and read logs from containers on the same host as the
`LXC 100` Docker services (Portainer, AdGuard, Frigate, Prometheus, …). The
socket is **only** mounted into the backend container — the browser never
talks to it directly (section 28 of the spec). The backend container starts
as root just long enough for `docker-entrypoint.sh` to align its
unprivileged `homelab` user with the host's `docker.sock` group (that GID
varies per host and can't be baked into the image), then drops to that user
via `su-exec` before running any application code.

## Local development (without Docker)

```bash
# backend
cd backend
npm install
cp ../.env.example .env   # or export the vars another way
npm run dev                # http://localhost:4000

# frontend, in another terminal
cd frontend
npm install
npm run dev                # http://localhost:5173, proxies /api and /ws to :4000
```

## Repository layout

```
homelab-contr-le-/
├── backend/            # Express API, integrations, engines, SQLite migrations
├── frontend/            # React app (Vite)
├── docs/                 # Architecture notes and the original functional spec
├── docker-compose.yml
├── .env.example
└── README.md
```

## What's implemented

- Session auth (bcrypt + httpOnly JWT cookie + CSRF token + rate limiting)
  with `viewer` / `operator` / `admin` roles.
- **Cockpit** — health summary, host cards, critical services, alerts,
  resource summary, recent activity, and a per-user customizable layout
  (show/hide/reorder sections, section 44).
- **Infrastructure** — topology view + machine cards, System Map failure
  correlation: a downed host or a dead Docker daemon rolls its dependent
  services into one alert instead of raising one per service (section 40).
- **Services** — live Docker container list, filters (including "updates
  available"), logs, start/stop/restart with the three-level confirmation
  model (section 21), and a Frigate detail panel (cameras/events) in its
  drawer.
- **Storage** — TrueNAS pools/datasets/disks/SMART/snapshots + scrub, and a
  Backups panel tracking 3-2-1 status for Home Assistant/TrueNAS
  snapshot/custom-webhook backups (sections 11-12).
- **Network** — AdGuard DNS query/block stats with a protection toggle, NPM
  proxy hosts and certificate-expiry warnings, WireGuard peer status
  (sections 13-15).
- **Home Assistant** — entity availability count and unavailable-entity
  list, best-effort Zigbee2MQTT device count (section 16).
- **Monitoring** — Prometheus-backed charts per host/metric/period, with an
  "Open in Grafana" escape hatch.
- **Events** — alerts / system events / user actions with severity, source
  and date-range filters, plus an admin-only audit log (section 29).
- **Administration** — integration status, user list, quick actions,
  automation rules, and notification channels.
- **Automations** — "if a service/host stays down for N minutes, run
  &lt;level 1/2 action&gt;" rules, evaluated every 30s with a cooldown
  (section 44's "automatisations", scoped to a concrete rule engine).
- **Notifications** — Discord webhooks and Home Assistant `notify` service
  (covering "mobile" push without new push infrastructure) fire on new
  alerts by severity threshold, plus an in-app notification center in the
  top bar (sections 25, 44).
- **Update detection** — background check of running containers against
  Docker Hub digests, surfaced as an "Updates" filter in Services
  (section 39; only Docker Hub images are checked, others read as
  "undetermined").
- Command palette (Ctrl+K), universal search, resource drawers, toasts.
- WebSocket push of the monitoring snapshot every ~10s so the UI feels
  live without hammering every integration on every page view.

## What's intentionally not here

Per section 21, destructive actions (host shutdown/reboot, pool/dataset
deletion, etc.) are **not** wired to one-click handlers anywhere in this
app — those stay in Proxmox/TrueNAS's own UI. The action engine
(`backend/src/engines/actions.ts`) only defines level 1/2 actions, and the
automation engine can only ever trigger one of those.

`docs/ARCHITECTURE.md` documents a few Phase 3 items from the spec that
were deliberately open-ended ("détection d'anomalies", "notification
mobile") and the concrete, bounded interpretation implemented here instead
of a vague catch-all.

## Configuring integrations

See `.env.example` for the full list. Nothing is required except
`JWT_SECRET`, `ADMIN_PASSWORD` and `DOCKER_ENABLED` (on by default) to get a
useful cockpit; every other integration lights up additional data as you
configure it, independently of the others.
