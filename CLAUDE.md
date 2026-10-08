# eco-board

Personal EcoFlow battery monitoring dashboard: polls the EcoFlow Developer API,
stores readings in PostgreSQL, and shows historical charts in a web page.
Full plan: [docs/eco-board-brief.md](docs/eco-board-brief.md).

## Stack

- Node.js 22+ (developed on 24 LTS), **plain JavaScript, ES modules** — no TypeScript
- Server: no build step, runs the files in `server/` directly
- Express.js for the API and static files
- PostgreSQL 18 in Docker (`docker-compose.yml`), driver: `pg`
- Frontend: single HTML page; modules in `client/` bundled by esbuild into
  `public/dist/app.js`; Chart.js stays a separate file (served from node_modules)

## Commands

```sh
docker compose up -d     # start PostgreSQL
docker compose ps        # check status (should be "healthy")
docker compose down      # stop (data is kept in the pgdata volume)
docker compose down -v   # stop AND delete all data

npm start                # production build of the dashboard, then start the app (server/main.js)
npm run start:dev        # same with a development build (readable, with source map)
npm run build            # production bundle of client/ into public/dist/: minified, no source map
npm run build:dev        # development bundle: readable, with a source map
npm run migrate          # apply new files from migrations/ (safe to run repeatedly)
npm run seed:fake        # replace device FAKE-DEVICE with 30 days of simulated readings
npm test                 # run the tests in test/ (no database needed)
```

## How it fits together

- `server/main.js` starts everything in order (database, migrations, server, poller)
  and stops it in reverse order on SIGINT/SIGTERM.
- `server/poller.js` calls `source.readCurrent()` every `POLL_INTERVAL_MS` and saves
  the result with `insertReading()`. A source is any object with `deviceSn` and
  `readCurrent()`; today only `server/sources/fake-source.js` exists. The EcoFlow
  source will be a new file in `server/sources/` with the same shape.
- `server/server.js` serves the JSON API and `public/` (the dashboard).
- The dashboard source is browser ES modules in `client/`: `client/app.js` only
  starts the other modules, one file per part of the page (header, cards, charts,
  refresh) plus small helpers (api, config, format). Keep each module to one
  topic and export only what other modules need.
- `scripts/build.js` bundles `client/` into `public/dist/app.js` (production:
  minified, no source map; `--dev`: readable, with a source map). It cleans
  `public/dist/` first. It uses esbuild's JavaScript API on purpose: a Windows
  group policy blocks running `esbuild.exe` from the command line.
  `public/dist/` is not in Git.
- `public/` holds only what the browser loads; never put source files there.

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
- Tests use Node's built-in runner (`node:test`, `node:assert`) and live in
  `test/*.test.js`. Run `npm test` after every change, and add or update a test
  for changed behavior. Dashboard tests use the fake page in `test/fake-page.js`.
- Comments are plain text: no pseudo-graphic decoration such as `// --- Charts ---`,
  `# ===`, or boxes drawn with symbols. A section header is just `// Charts`.
