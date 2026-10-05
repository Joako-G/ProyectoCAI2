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

## Members API (demo)

Members are stored in a JSON file (`backend/data/members.json`, or the path in `MEMBERS_FILE`). This is demo-only persistence: no real data, no concurrent use. Removal is logical, so there is no delete endpoint.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/members?search=&status=` | `status` is `active` or `inactive` |
| GET | `/api/members/:id` | 404 if unknown |
| POST | `/api/members` | 201 with the created member |
| PUT | `/api/members/:id` | Replaces personal fields |
| POST | `/api/members/:id/deactivate` | Body `{ "reason": "..." }` |
| POST | `/api/members/:id/reactivate` | |

Errors are JSON `{ error, message }`: 400 `validation_error` (with `fieldErrors`) or `invalid_json`, 404 `not_found`, 409 `conflict`, 500 `internal_error`.

Load the synthetic seed (`backend/data/members.seed.json`, 8 fake members) through the service rules; it refuses if the file already has data unless `--force` is given:

```sh
pnpm --filter @club-socios/backend seed          # add --force to replace existing data
```

Run backend and frontend together (two terminals). The Vite dev server proxies `/api` to `http://localhost:3001`:

```sh
pnpm --filter @club-socios/backend build && pnpm --filter @club-socios/backend start
pnpm --filter @club-socios/frontend dev
```

## Boundaries

Frontend features live under `frontend/src/features/`; `members` and `payments` reserve `components`, `hooks`, `services`, `schemas`, and `types` for later work. Global `assets`, `components`, `layouts`, `pages`, `hooks`, `services`, `store`, `types`, `utils`, `routes`, and `config` live under `frontend/src/`; `frontend/public/` is ready for static assets. Backend domain modules live under `backend/src/modules/`; when implemented, each module should own its route, controller, service and repository boundaries. `backend/src/{config,middlewares,database,shared,types,utils}` and `backend/tests/` are placeholders. None of the domain directories contain behavior yet.

See `docs/team-handoff.md` for teammate onboarding and future scope. `docs/{requirements,diagrams,api}` are empty placeholders; the current requirements source is the parent workspace's `Documentacion/`, which is not copied into this repository.
