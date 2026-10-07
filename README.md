# eco-board

A personal dashboard for EcoFlow portable power stations. It reads battery
data from the EcoFlow Developer API every few minutes, stores it in
PostgreSQL, and shows charts of battery level, power, and temperature over time.

> **Status:** early development. The database setup works; the EcoFlow API
> client and the dashboard are not built yet. See the
> [project brief](docs/eco-board-brief.md) for the plan.

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

4. Create the database tables:

   ```sh
   npm run migrate
   ```

## Commands

| Command | What it does |
|---|---|
| `docker compose up -d` | Start PostgreSQL in the background |
| `docker compose ps` | Check that the database is running (`healthy`) |
| `docker compose down` | Stop PostgreSQL (data is kept) |
| `npm run migrate` | Apply new database migrations |

## License

MIT
