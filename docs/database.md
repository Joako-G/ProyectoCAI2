# Database (PostgreSQL with pgvector)

PostgreSQL holds face recognition (`face_profiles`) and the entrance log (`access_entries`: member id, result, reason code, method `dni` or `face`, time and the staff user id; never a DNI or a name). Every other module still uses JSON files. The database is optional: without `DATABASE_URL` the server runs as before, the face endpoints answer `503 faces_unavailable`, `GET /api/access/entries` answers `503 entries_unavailable`, and entrance checks still answer but are not logged.

Requires Docker Desktop (Docker Compose v2).

## Start and stop

```sh
docker compose up -d        # starts the db service (image pgvector/pgvector:0.8.1-pg17)
docker compose ps           # wait until STATUS says "healthy"
docker compose down         # stops it, keeps the data
docker compose down -v      # stops it and deletes the data volume
```

The port is published on `127.0.0.1:5432` only.

## Development credentials

These are public defaults for development. Never use them anywhere real. Override them with environment variables before the first `docker compose up` (`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`).

| Variable | Value |
| --- | --- |
| `DATABASE_URL` (backend, development) | `postgres://club:club_dev_password@127.0.0.1:5432/club_socios` |
| `TEST_DATABASE_URL` (backend tests) | `postgres://club:club_dev_password@127.0.0.1:5432/club_socios_test` |

The tests use their own database, `club_socios_test`, which they empty and recreate. Never point `TEST_DATABASE_URL` at development data. The test database is created by `docker/postgres-init/01-create-test-database.sql`, which Docker runs only when the data volume is first created. On an older volume, create it by hand:

```sh
docker compose exec db psql -U club -d club_socios -c "CREATE DATABASE club_socios_test"
```

`backend/.env.example` is not updated: the backend does not load `.env` files, so set the variables in the shell.

```sh
# bash
export DATABASE_URL=postgres://club:club_dev_password@127.0.0.1:5432/club_socios
# PowerShell
$env:DATABASE_URL = "postgres://club:club_dev_password@127.0.0.1:5432/club_socios"
```

## Migrations

SQL files live in `backend/src/database/migrations`, named `NNN_description.sql`. Each file runs once, in numeric order, inside its own transaction, and is recorded in the `schema_migrations` table. A failing file is rolled back and stops the run. Never edit a migration that was already applied; add a new file.

```sh
pnpm --filter @club-socios/backend migrate     # needs DATABASE_URL
```

The server also applies pending migrations when it starts, if `DATABASE_URL` is set. The database only serves face recognition, so if it is down or a migration fails the server still starts: it logs one line without credentials and the face routes answer 503 `faces_unavailable` until the server restarts. The `migrate` script, by contrast, fails loudly. The pool waits at most 5 s to connect and cancels any statement after 10 s.

## Tests

```sh
export TEST_DATABASE_URL=postgres://club:club_dev_password@127.0.0.1:5432/club_socios_test
pnpm --filter @club-socios/backend test
```

Without `TEST_DATABASE_URL` the database tests are skipped, with a message naming the variable, and the rest of the suite runs. The tests in `backend/tests/database` run one file at a time because they share the test database.

## Backups

The daily backup copies JSON files only. Data in PostgreSQL is not backed up yet; solve that before any real use.
