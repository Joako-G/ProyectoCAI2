# Team handoff: club membership system

This repository contains only a runnable scaffold. A second developer can pick up a separate feature without assuming that the placeholder directories already implement the club's business rules.

## Quick path

1. Open this repository as the working directory; run `pnpm install`, `pnpm -r build`, and `pnpm -r typecheck`.
2. Read the [scaffold task](../odd/tasks/project-scaffold.md) and the parent workspace's `Documentacion/` for current requirements. If that folder is unavailable in your checkout, request access rather than relying on older root files.
3. Read this handoff as the portable source of team context. For a manual, per-machine Engram save, follow [the PowerShell instructions](../.engram/README.md). Markdown is **not** imported into Engram automatically; do not import parent-project history.

## Agreed boundaries

| Area | Current state and next boundary |
| --- | --- |
| Frontend | React + TypeScript + Vite. Put feature work in `frontend/src/features/{members,payments,disciplines,memberships,auth}`; `members` and `payments` reserve `components`, `hooks`, `services`, `schemas`, and `types`. Use top-level `components`, `hooks`, `services`, `utils`, and `types` for genuinely shared code. |
| Backend | Express + TypeScript. Put future domains in `backend/src/modules/{members,payments,disciplines,memberships,users,auth}`; keep route → controller → service → repository responsibilities distinct when they become necessary. |
| Infrastructure | `backend/src/config`, `backend/src/middlewares`, and `backend/src/database` are placeholders; `backend/src/server.ts` starts the app and `backend/tests` is empty. The only HTTP route is infrastructure-only `GET /health`; no database or environment loader is wired. Root `docs/{requirements,diagrams,api}` are placeholders, not the requirements source. |
| Delivery | Two developers can take separate, reviewable work units, with build/typecheck and evidence in the same commit. Agree on API contracts before wiring frontend to backend. |

## Next work, not part of this scaffold

The planned demonstration sequence is a simple login, user CRUD, then member CRUD using synthetic data. A browser-only demo is not production authentication or persistence. PostgreSQL, migrations, Docker, and biometric access are later decisions/work; do not treat their absence as a broken setup. Do not use real club/member records or credentials for demonstrations.

The current-state requirements describe manual receipts, physical cards, and monthly Excel sheets; they do **not** establish the final software rules. In particular, fee timing, partial payments, and deactivation have unresolved questions in `Documentacion/Informe_Relevamiento_ClubOCEA.pdf` (section 6). Confirm rules with the club before encoding them. Avoid stale legacy documents at the parent root.

## Engram portability and safety

`.engram/config.json` names this project `club-socios`. One curated project-scoped observation was saved locally, but native sync output was **not** committed: the generated manifest named the local account and its compressed chunk embedded an absolute local path. Sharing those artifacts would leak personal machine metadata. Do not run `engram sync --all` or `engram export` from the parent workspace: that would mix obsolete or personal memories into the team handoff. If a later reviewed native export is added, the colleague can run `engram sync --status` and `engram sync --import` from the checkout with matching project, then confirm the observation in their own local Engram database. Inspect the manifest and decompress/review every chunk and its provenance before sharing or importing. Import changes a local Engram database, not this Git repository.

## Shared JSON store

`backend/src/database/json-store.ts` provides `createJsonStore<T>(filePath, defaultValue)`, returning `read()` and `update(fn)`. A missing file yields the default value, writes are atomic (temp file + rename) and serialized per file, and invalid JSON on disk throws instead of being overwritten.

- Each module owns its own file (for example `members.json`, `users.json`); do not share one file between modules.
- It is demo-only: not for production, real data, or multi-process use.
- Domain code depends on a repository interface; only the JSON repository implementation may import this helper.
- Run its tests with `pnpm --filter @club-socios/backend test`.
