# eco-board

A personal dashboard for EcoFlow portable power stations. It reads battery
data from the EcoFlow Developer API every few minutes, stores it in
PostgreSQL, and shows charts of battery level, power, and temperature over time.

> **Status:** early development. The dashboard and the polling work with a
> simulated device; reading a real device through the EcoFlow API is not
> built yet. See the [project brief](docs/eco-board-brief.md) for the plan.

## Requirements

- [Node.js](https://nodejs.org/) 22 or newer
- [Docker](https://www.docker.com/) with Docker Compose (or Podman with `podman compose`)

Works on Windows and Linux.

## Setup

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/e-Watson-dot-ua/eco-board.git
   cd eco-board
   npm install
   ```

2. Create your configuration file from the template:

   ```sh
   cp .env.example .env
   ```

   On Windows PowerShell: `Copy-Item .env.example .env`

   Then open `.env` and set your own password in `POSTGRES_PASSWORD` **and** in
   `DATABASE_URL` (both must match).

3. Start PostgreSQL:

   ```sh
   docker compose up -d
   ```

4. Start the app (it builds the dashboard and creates the database tables):

   ```sh
   npm start
   ```

   Then open http://localhost:3000. Stop the app with Ctrl+C.

## Trying it without an EcoFlow device

Fill the database with 30 days of simulated readings:

```sh
npm run seed:fake
```

While `ECOFLOW_DEVICE_SN` in `.env` is empty, the dashboard shows this
simulated device (`FAKE-DEVICE`), and the running app adds a new simulated
reading every 5 minutes (`POLL_INTERVAL_MS`). Running the command again
replaces the old simulated data.

## Commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start PostgreSQL in the background |
| `docker compose ps` | Check that the database is running (`healthy`) |
| `docker compose down` | Stop PostgreSQL (data is kept) |
| `npm start` | Build the dashboard, then start the app at http://localhost:3000 |
| `npm run build` | Build the dashboard only (`client/` → `public/dist/`) |
| `npm run migrate` | Apply new database migrations without starting the app |
| `npm run seed:fake` | Replace the simulated device's data with 30 fresh days |
| `npm test` | Run the automated tests (no database needed) |

## License

[MIT](LICENSE)
