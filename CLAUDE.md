# eco-board

Personal EcoFlow battery monitoring dashboard: polls the EcoFlow Developer API,
stores readings in PostgreSQL, and shows historical charts in a web page.
Full plan: [docs/eco-board-brief.md](docs/eco-board-brief.md).

## Stack

- Node.js 22+ (developed on 24 LTS), **plain JavaScript, ES modules** — no TypeScript, no build step
- Express.js for the API and static files
- PostgreSQL 18 in Docker (`docker-compose.yml`), driver: `pg`
- Frontend: single HTML page with Chart.js

## Commands

```sh
docker compose up -d     # start PostgreSQL
docker compose ps        # check status (should be "healthy")
docker compose down      # stop (data is kept in the pgdata volume)
docker compose down -v   # stop AND delete all data

npm start                # start the app (src/main.js); runs migrations on startup
npm run migrate          # apply new files from migrations/ (safe to run repeatedly)
npm run seed:fake        # replace device FAKE-DEVICE with 30 days of simulated readings
```

## How it fits together

- `src/main.js` starts everything in order (database, migrations, server, poller)
  and stops it in reverse order on SIGINT/SIGTERM.
- `src/poller.js` calls `source.readCurrent()` every `POLL_INTERVAL_MS` and saves
  the result with `insertReading()`. A source is any object with `deviceSn` and
  `readCurrent()`; today only `src/sources/fake-source.js` exists. The EcoFlow
  source will be a new file in `src/sources/` with the same shape.
- `src/server.js` serves the JSON API and `public/` (the dashboard).
- The dashboard is plain browser ES modules, no build step: `public/js/app.js`
  only starts the other modules in `public/js/`, one file per part of the page
  (header, cards, charts, refresh) plus small helpers (api, config, format).
  Keep each module to one topic and export only what other modules need.

## Conventions

- ESM only: `import`/`export`, never `require()`. Relative imports include the
  `.js` extension (`./database.js`). Use `node:` prefix for built-ins (`node:fs`).
  Use `import.meta.dirname` instead of `__dirname`.
- Database schema changes go in a **new** numbered file in `migrations/`
  (`002_...sql`). Never edit a migration that has already been committed.
- Configuration comes from `.env` (see `.env.example`). Never commit `.env`;
  when adding a new setting, add it to `.env.example` too.
- Development happens on both Windows 11 and Fedora: keep everything
  cross-platform (no bash-only npm scripts, LF line endings via `.gitattributes`,
  named Docker volumes rather than bind mounts).
- The repo is public: no secrets, tokens, or personal data in code or commits.
- Comments are plain text: no pseudo-graphic decoration such as `// --- Charts ---`,
  `# ===`, or boxes drawn with symbols. A section header is just `// Charts`.
