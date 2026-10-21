# Disciplines (catalog + member assignment)

## Objective
Add the club's discipline catalog and let each member be assigned one or more disciplines, end to end (backend API + React UI).

## Problem and rationale
The specs require it and nothing implements it yet:
- RF-24 (Modelo, p5): manage disciplines as a closed list, each with its associated teacher.
- RF-01 / RF-04 (Modelo, p5): a member is registered with discipline(s) and can be assigned one or more.
- RN-01 (Informe, p14): discipline is required at registration.
- Today discipline is free text in the club's Excel with many variants (BASQ.M / BASQ M / BASQ,M; Informe p2). A closed catalog fixes that, and later features depend on it: fees (cuota = social + discipline), per-discipline listings for teachers (RF-19/RF-20, CU-20).

## Decisions (defaults chosen by the parent, 2026-10-21; user may override)
- Discipline fields: id, name (required, unique case-insensitive, trimmed), teacherName (required free text; teachers are not system users, RF-25 roles exclude them), status `active`/`inactive` with deactivation date. Removal is logical, matching members.
- No price on the discipline: amounts belong to the tariffs feature (RF-23).
- Member gets `disciplineIds: string[]`. At least one is required on create and on update (RF-01, RN-01). Every id must exist; newly added ids must be active. An already-assigned discipline that was later deactivated may be kept on edit. Duplicate ids are rejected.
- Existing stored members without the field read as `[]` (no data migration). Editing such a member requires choosing at least one discipline.
- Members list API accepts `?disciplineId=` to filter (prepares RF-19/RF-20).
- Member service depends on a small discipline lookup port, not on the disciplines repository, to keep module boundaries.
- Synthetic seed catalog only (fictional teacher names). The real list should come from the club.

## Authorized scope and constraints
- Edit only this repository, on branch `feat/disciplines` (from `manu`). No push, pull request or remote operation without explicit authorization.
- Do not commit the pre-existing uncommitted change in `docs/team-handoff.md`; it is not part of this feature.
- Out of scope: fees/tariffs, per-discipline reports, teacher accounts, auth on these routes.
- TDD: ON. Source: project convention recorded in `odd/tasks/members-abm.md` (explicit user choice, 2026-10-05). Runner: Vitest (+ Node test runner for auth/users), `pnpm --filter <package> test`. Record RED, GREEN, REFACTOR per task.
- Delivery: single feature branch with work-unit commits per task, as the previous feature was delivered into `manu`. Forecast ~1,200–1,600 authored lines (above the ~400 budget); slices are the task commits below.

## Tasks
- [x] T1 — Backend disciplines module. `backend/src/modules/disciplines/`: types, validation, service (create, update, deactivate, reactivate, list with status filter, get), repository interface + JSON repository (`backend/data/disciplines.json`, `DISCIPLINES_FILE` override) using the shared JSON store, routes under `/api/disciplines` with the same error envelope as members (400/404/409). Synthetic seed in `backend/data/disciplines.seed.json`, loaded by the existing seed script. Route: delegated direct writer (2+ non-trivial files). Acceptance: tests first, API tests pass, build/typecheck pass.
- [ ] T2 — Member ↔ discipline assignment (backend). `disciplineIds` on member types/validation/service via a discipline lookup port; legacy members read as `[]`; `?disciplineId=` filter; members seed gets valid ids. Route: delegated direct writer. Acceptance: rule tests first; existing member tests still pass.
- [ ] T3 — Disciplines screen (frontend). Sidebar entry, list with status filter, create/edit form (name, teacher), deactivate/reactivate, loading/empty/error states, same visual language as members. Vite proxy already covers `/api`. Route: delegated direct writer. Acceptance: component tests pass; works against the real API.
- [ ] T4 — Disciplines in member UI. Multi-select in the member form (active disciplines; keep already-assigned inactive ones), client validation mirroring backend, disciplines shown in detail and list, discipline filter on the list. Route: delegated direct writer. Acceptance: component tests pass; full flow checked in the browser.

## Applicable checks
- `pnpm --filter <package> test` (TDD evidence per task).
- `pnpm -r build` and `pnpm -r typecheck`.
- Backend smoke check of `/api/disciplines` and `/api/members?disciplineId=`; browser check for T3–T4.
- Gentle-AI review assessment after each work-unit commit (RDD on by default).
- `git status` and commit readback after each task.

## Progress
- 2026-10-21: Specs reviewed (Informe de Relevamiento, Modelo del Sistema, narrativa). Branch `feat/disciplines` created from `manu`. Feature document created.
- 2026-10-21 T1 done. Route: delegated direct writer (2+ non-trivial files). TDD: RED observed before implementation (`Test Files 5 failed | 5 passed (10)`, `Tests 3 failed | 127 passed (130)`; new modules unresolved, `disciplinesFilePath is not a function`), then GREEN `Test Files 10 passed (10)`, `Tests 161 passed (161)`; REFACTOR: shared `dataFilePath` helper in `config/paths.ts`. Checks: backend test, `pnpm -r typecheck`, `pnpm -r build` (frontend build slow, ~8 min on this machine, exit 0), smoke of built backend (POST 201, duplicate name 409, GET list) and seed script (`--force` behavior) with temp files. ~800 authored lines (additions+deletions, ~65% tests/seed/docs). Notes: `AppDependencies.disciplineService` is optional so existing members-only app tests stay untouched; the service reuses `toIsoDate` from the members validation module (candidate to move to `shared/` in T2); `findByIds(ids)` is the lookup for T2; seed script now seeds disciplines first, then members. Assessed review tier / outcome: pending parent.

## Next step
T2.
