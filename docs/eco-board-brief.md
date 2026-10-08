# eco-board: Project Brief

## Overview
A personal EcoFlow battery monitoring dashboard that reads real-time device data via API, stores historical readings, and visualizes trends. Foundation for an eventual Node.js SDK (JavaScript, shipped with TypeScript type definitions) targeting developers.

## Phase 1: MVP (6-8 weeks, 6-8 hours/week)

### Goals
1. Authenticate with EcoFlow Developer API (signed requests)
2. Poll device status every 5 minutes (battery %, power input/output, temperature)
3. Store readings in PostgreSQL (running in a container)
4. Build a simple web dashboard with historical graphs (24h, week, month views)
5. Handle errors gracefully (API failures, DB unavailable at startup, retries)

### Tech Stack
- **Runtime:** Node.js (LTS) + plain JavaScript, ES modules (`"type": "module"` in package.json); no build step for the server, the dashboard is bundled with esbuild
- **API Server:** Express.js
- **Database:** PostgreSQL 18 in a container (Docker Compose; Podman-compatible)
- **Frontend:** Chart.js or vanilla HTML5 canvas
- **Development:** Mixed OS — Windows 11 (Docker Desktop) and Fedora (Docker CE or Podman)
- **Deployment:** Runs on home laptop (Fedora) 24/7
- **VCS:** Git, public GitHub repo

### Project Structure
```
eco-board/
├── server/
│   ├── main.js                  (entry point: startup order, graceful shutdown)
│   ├── poller.js                (reads a source at an interval, saves readings)
│   ├── sources/
│   │   ├── fake-source.js       (simulated device, used until the EcoFlow source exists)
│   │   ├── fake-device.js       (battery simulation, shared with seed-fake)
│   │   └── ecoflow-source.js    (planned: EcoFlow API, request signing)
│   ├── database.js              (PostgreSQL pool, queries, connect-with-retry)
│   ├── migrations.js            (applies migrations/ on startup)
│   ├── server.js                (Express REST API, static server, request log)
│   ├── env.js                   (validated settings from .env)
│   └── log.js                   (console logging with timestamps)
├── client/                      (dashboard source: browser ES modules, bundled by esbuild)
│   ├── app.js                   (starts the dashboard modules)
│   ├── api.js                   (requests to the server, with a timeout)
│   ├── config.js                (settings from /api/config)
│   ├── format.js                (texts for ages and intervals)
│   ├── header.js                (connection pill, status line, charging badge, footer)
│   ├── cards.js                 (status cards, battery gauge)
│   ├── charts.js                (range buttons, Chart.js charts)
│   └── refresh.js               (Refresh button, automatic refresh)
├── public/                      (everything the browser loads)
│   ├── index.html
│   ├── styles.css
│   ├── favicon.svg
│   └── dist/                    (built by npm run build, not in Git)
├── scripts/
│   ├── build.js                 (npm run build / build:dev: esbuild bundle of client/)
│   ├── migrate.js               (npm run migrate)
│   └── seed-fake.js             (npm run seed:fake)
├── test/                        (npm test: node:test, no database needed)
│   ├── *.test.js
│   └── fake-page.js             (fake DOM, fetch and Chart.js for dashboard tests)
├── migrations/
│   └── 001_init.sql
├── docs/
├── docker-compose.yml           (PostgreSQL service)
├── .env.example
├── .gitattributes               (LF line endings across Windows/Linux)
├── .gitignore
├── CLAUDE.md                    (instructions for Claude Code)
├── README.md
├── LICENSE (MIT)
└── package.json
```

### MVP Features
- **Backend:**
  - Authenticate with EcoFlow Developer API using access key + secret key
    (HMAC-SHA256 request signing — **verify against current EcoFlow developer docs**
    before implementing; region-specific API host)
  - Fetch device quotas (battery level, input/output power, temperature)
  - Insert readings into PostgreSQL every 5 minutes
  - Retry DB connection on startup (container may not be ready after reboot)
  - Error logging and retry/backoff logic for API calls

- **Database:**
  - Table `device_readings`:
    - `id`, `device_sn`, `ts` (timestamptz), `battery_level`, `power_in`, `power_out`, `temperature`
    - `raw jsonb` — full quota payload (keys differ between EcoFlow models; lets new metrics be backfilled)
    - Index on `(device_sn, ts)`
  - Schema managed via plain SQL files in `migrations/`, applied on app startup
  - Query last 24 hours (raw), 7 days and 30 days (aggregated in SQL, e.g. `date_trunc('hour', ts)`)

- **Frontend:**
  - Single HTML page with 3 charts (24h, 7d, 30d views)
  - Real-time status display (current battery %, power in/out)
  - Manual refresh button

### Infrastructure
- `docker compose up -d` starts PostgreSQL; same command on Windows and Fedora
- Named volume for data (avoids SELinux `:Z` issues on Fedora with bind mounts)
- Port bound to `127.0.0.1` only — not exposed on the LAN
- `restart: unless-stopped` (Docker) or a Quadlet/systemd unit (Podman) for start on boot
- Healthcheck via `pg_isready`
- Periodic `pg_dump` backup script

### Success Criteria
- Dashboard displays live battery %, power output, temperature
- Data persists across restarts (app and container)
- Graphs render historical trends smoothly
- Runs stable for a week without intervention
- EcoFlow API authentication works unattended
- Fresh clone → running setup on both Windows and Fedora following the README
- Clean git history, README explains setup

## Post-MVP Roadmap
1. Containerize the Node.js app (add service to compose)
2. Evaluate EcoFlow MQTT for push-based real-time updates instead of polling
3. Extract EcoFlow client into reusable SDK
4. Add integrations (IFTTT, Home Assistant, Google Sheets)
5. Evaluate SaaS platform viability

## Notes
- EcoFlow device already available (personal EcoFlow unit)
- Development split between Windows 11 and Fedora; production on Fedora laptop
- Fedora ships Podman by default — either install Docker CE or use `podman compose`
- Public GitHub repo from day 1 (MIT license)
