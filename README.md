# MK HomeLab Control Center

A personal cockpit for a home lab: **Monitor → Understand → Act**, from one
dark, keyboard-first interface. It does not replace Grafana, Proxmox,
Portainer, TrueNAS or Home Assistant — it sits above them, aggregating their
state and giving you the handful of safe actions you actually reach for day
to day, with a link out to the native UI for everything else.

This repository implements the **Phase 1 (MVP)** scope from the functional
spec in `docs/ARCHITECTURE.md`: authentication, the Cockpit, live
Infrastructure/Services views backed by Docker and Proxmox, container
actions, an audit log, and the MK Design System v2.0 look.

## Stack

- **Backend** — Node.js 20, TypeScript, Express, SQLite (`better-sqlite3`),
  `ws` for live push updates. No ORM: plain SQL migrations run on boot.
- **Frontend** — React + TypeScript + Vite, TanStack Query, plain CSS built
  on MK Design System tokens (no UI framework).
- **Integrations** — Docker (via `dockerode` against the daemon socket),
  Proxmox VE (REST API + token), Prometheus (query API, read-only),
  Home Assistant and TrueNAS (REST, optional/Phase 2-leaning).

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
talks to it directly (section 28 of the spec).

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

## What's implemented (Phase 1)

- Session auth (bcrypt + httpOnly JWT cookie + CSRF token + rate limiting)
  with `viewer` / `operator` / `admin` roles.
- Cockpit: health summary, host cards, critical services, alerts, resource
  summary, recent activity.
- Infrastructure: topology view + machine cards, backed by Proxmox for M83
  and best-effort for the Raspberry Pi / TrueNAS host.
- Services: live Docker container list, filters, logs, start/stop/restart
  with the three-level confirmation model from section 21.
- Events: alerts / system events / user actions, plus an admin-only audit
  log (section 29).
- Administration: integration status, user list, quick actions.
- Storage / Network / Home Assistant / Monitoring: live where an
  integration is configured, otherwise a clear placeholder explaining what
  ships in Phase 2, with an "Open native UI" link.
- WebSocket push of the monitoring snapshot every ~10s so the UI feels
  live without hammering every integration on every page view.

## What's intentionally not here

Per section 21, destructive actions (host shutdown/reboot, pool/dataset
deletion, etc.) are **not** wired to one-click handlers anywhere in this
app — those stay in Proxmox/TrueNAS's own UI. The action engine
(`backend/src/engines/actions.ts`) only defines level 1/2 actions.

## Configuring integrations

See `.env.example` for the full list. Nothing is required except
`JWT_SECRET`, `ADMIN_PASSWORD` and `DOCKER_ENABLED` (on by default) to get a
useful cockpit; Proxmox/Prometheus/Home Assistant/TrueNAS light up
additional data as you configure them.
