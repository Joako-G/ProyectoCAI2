# Club members scaffold

A pnpm workspace for a React/TypeScript/Vite frontend and an Express/TypeScript backend. This is a runnable foundation, not a login or membership system.

## Quick start

Requires Node.js 20.19+ and pnpm 11. From this directory:

```sh
pnpm install
pnpm -r build
pnpm -r typecheck
pnpm --filter @club-socios/frontend dev
```

In another terminal, run `pnpm --filter @club-socios/backend start` after building (`backend/src/server.ts` compiles to `backend/dist/server.js`). The frontend uses Vite's local address; the backend listens on port 3001 by default. Check `http://localhost:3001/health` for `{"status":"ok"}`. To change the backend port, set the `PORT` environment variable; `backend/.env.example` documents the default but is not loaded automatically. The root and frontend `.env.example` files are empty placeholders; no credentials are required.

## Backups

While the backend runs it copies every data file, and the PostgreSQL database as `database.dump` when `DATABASE_URL` is set, once a day to `backend/backups`, or to the folder in `BACKUP_DIR` (for example an external drive), and keeps the newest copy of each of the last 30 days plus the 5 most recent copies. A configured folder must already exist: with the drive unplugged the copy fails and the screen says so. The head secretary sees the last copy in the Respaldo section. To restore a copy, follow `docs/backup-restore.md`.

## Database (optional)

Face recognition uses PostgreSQL with pgvector through Docker Compose. Without `DATABASE_URL` the app runs as before and the face features are off. Start it with `docker compose up -d`; setup, environment variables, migrations and tests are in `docs/database.md`.

## Members API (demo)

Members are stored in a JSON file (`backend/data/members.json`, or the path in `MEMBERS_FILE`). This is demo-only persistence: no real data, no concurrent use. Removal is logical, so there is no delete endpoint.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/members?search=&status=&disciplineId=` | `status` is `active` or `inactive`; `disciplineId` keeps members assigned to that discipline; filters combine |
| GET | `/api/members/:id` | 404 if unknown |
| POST | `/api/members` | 201 with the created member |
| PUT | `/api/members/:id` | Replaces personal fields and disciplines |
| POST | `/api/members/:id/deactivate` | Body `{ "reason": "..." }` |
| POST | `/api/members/:id/reactivate` | |

Each member has `disciplineIds` (array of discipline ids). At least one is required on create and on update (`fieldErrors.disciplineIds`); ids cannot repeat, must exist, and newly added ones must be active, but a discipline already assigned to the member may be kept after it was deactivated. Members stored before this field existed read as `disciplineIds: []` (no migration); editing one requires choosing at least one discipline.

Errors are JSON `{ error, message }`: 400 `validation_error` (with `fieldErrors`) or `invalid_json`, 404 `not_found`, 409 `conflict`, 413 `payload_too_large` (body over 100kb), other client body errors as their 4xx `bad_request` (e.g. 415), 500 `internal_error`.

Load the synthetic seeds (`backend/data/members.seed.json`, 8 fake members, and `backend/data/disciplines.seed.json`, 6 disciplines with fixed ids that the members reference) through the service rules, validating members against the seeded disciplines. The run refuses, before writing anything, if either file already has data unless `--force` is given:

```sh
pnpm --filter @club-socios/backend seed          # add --force to replace existing data
```

## Disciplines API (demo)

The disciplines catalog is stored in a JSON file (`backend/data/disciplines.json`, or the path in `DISCIPLINES_FILE`), with the same demo-only limits as members. Each discipline has a name (required, unique ignoring case and accents, also against inactive ones) and one or more teachers. Members enroll in the discipline only, not with a specific teacher. Removal is logical, so there is no delete endpoint.

Teachers are user accounts with the `teacher` role. A create or update sends `teacherIds` (at least one id of an active teacher account) and `leadTeacherId` (the one in charge, one of `teacherIds`); validation errors use the field keys `teachers` and `leadTeacher`. Who teaches a discipline is stored once, on the accounts (`disciplineIds`, the same list the users screen edits and the teacher roster reads): saving a discipline gives it to exactly the accounts sent and takes it from every other teacher. The discipline itself keeps only the id of the teacher in charge.

A discipline is answered with `teachers` and `leadTeacher` (the accounts' current names, by name), `teacherIds` and `leadTeacherId`. When the teacher in charge loses the discipline from the users screen, the first remaining teacher is in charge; with no teacher left, `teachers` is empty and `leadTeacherId` is `null`. A discipline saved before teachers were accounts (typed names, or the older single `teacherName`) is answered with those names, `teacherIds: []` and `leadTeacherId: null` until it is edited.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/disciplines?search=&status=` | `search` matches the name; `status` is `active` or `inactive` |
| GET | `/api/disciplines/teachers` | The active teacher accounts (`id`, `name`) a discipline can be given to |
| GET | `/api/disciplines/:id` | 404 if unknown |
| POST | `/api/disciplines` | 201 with the created discipline; 409 on a duplicate name |
| PUT | `/api/disciplines/:id` | Replaces name, teacher accounts and the one in charge |
| POST | `/api/disciplines/:id/deactivate` | 409 if already inactive |
| POST | `/api/disciplines/:id/reactivate` | 409 if already active |

Errors use the same JSON envelope as the Members API.

Run backend and frontend together (two terminals). The Vite dev server proxies `/api` to `http://localhost:3001`:

```sh
pnpm --filter @club-socios/backend build && pnpm --filter @club-socios/backend start
pnpm --filter @club-socios/frontend dev
```

## Boundaries

Frontend features live under `frontend/src/features/`; `members` and `payments` reserve `components`, `hooks`, `services`, `schemas`, and `types` for later work. Global `assets`, `components`, `layouts`, `pages`, `hooks`, `services`, `store`, `types`, `utils`, `routes`, and `config` live under `frontend/src/`; `frontend/public/` is ready for static assets. Backend domain modules live under `backend/src/modules/`; when implemented, each module should own its route, controller, service and repository boundaries. `backend/src/{config,middlewares,database,shared,types,utils}` and `backend/tests/` are placeholders. None of the domain directories contain behavior yet.

See `docs/team-handoff.md` for teammate onboarding and future scope. `docs/{requirements,diagrams,api}` are empty placeholders; the current requirements source is the parent workspace's `Documentacion/`, which is not copied into this repository.
