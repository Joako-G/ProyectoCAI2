# Members ABM (create, update, deactivate)

## Objective
Build the club members ABM end to end: a backend API persisted in a JSON file and a React UI that follows the visual language of the "Gestión Club" beta.

## Problem and rationale
The scaffold has no member behavior. The beta (`Gestion Club.dc.html`) only prototypes the member list and the member detail; its "Alta de socio" button has no handler, and there is no create, edit or removal design. Its mock data stores `edad` as a number (goes stale) and the guardian as free text. This feature implements the real flows and fixes those modeling issues instead of copying them.

## Decisions (user-confirmed, 2026-10-05)
- Persistence: JSON files read/written only by the backend, behind a repository interface so PostgreSQL can replace it later. Writes are atomic (temp file + rename) and serialized. Demo only: not for production, concurrent use, or real data.
- Work split: a teammate owns login + users ABM (`modules/{auth,users}`, `features/auth`). This feature owns members and stores them in `members.json`. The JSON storage helper is shared and must be agreed with the teammate before both use it.
- Removal is logical: deactivation sets status `inactive` with date and reason; records are never deleted and can be reactivated. v1 status is only `active`/`inactive`; fee-derived states (al día / por vencer / vencido) wait for the club's fee rules (relevamiento, section 6).
- v1 fields: memberNumber (auto), firstName, lastName, dni (unique), birthDate, category (manual: Infantil, Cadete, Mayor, Vitalicia), memberSince, whatsapp, email (optional), guardian name + contact (required when the member is a minor). Age is derived from birthDate. Disciplines, fees, biometrics and QR card are out of scope.
- UI follows the beta: IBM Plex Sans/Mono, Libre Baskerville for names and titles, background `#eef1f4`, text `#14171c`, dark sidebar `#1f2937`, accent `#1f4e8c` (hover `#163c6d`), success `#2d7d5a`, error `#a8321f`, warning `#8a6a1c`, white cards with `rgba(0,0,0,.09)` borders and 7–10px radius, status chips, uppercase mono table headers. Create/edit/deactivate screens are new designs in that same language.

## Authorized scope and constraints
- Edit only this repository, on branch `feat/members-abm`. No push, pull request or remote operation without explicit authorization.
- Synthetic data only. No real club records or credentials.
- Do not implement auth, users, disciplines, fees or biometrics. Member routes must be easy to protect once the teammate's auth lands.
- TDD: ON. Source: explicit user choice (2026-10-05). Runner: Vitest, installed per package as a devDependency, run with `pnpm --filter <package> test`. Every behavior task records observed RED, then GREEN, then REFACTOR.
- Delivery strategy: ask-on-risk. Forecast: about 1,600–2,000 authored changed lines across all tasks (above the ~400-line delivery budget).
- Chain strategy: feature-branch-chain (user choice, 2026-10-05). Tracker branch `feat/members-abm` (draft, no-merge tracker PR once remote work is authorized). Child branches `feat/members-abm-0N-<slug>`: child 1 targets the tracker, each later child targets the immediate parent. Accepted tradeoff: main gets the ABM only when complete; the teammate can branch from the T1 child to reuse the JSON store early.

## Slices
| Slice | Branch | Tasks | Base |
| --- | --- | --- | --- |
| 1 | `feat/members-abm-01-json-store` | T1 | `feat/members-abm` |
| 2 | `feat/members-abm-02-domain` | T2 | slice 1 |
| 3 | `feat/members-abm-03-api` | T3 | slice 2 |
| 4 | `feat/members-abm-04-ui-shell` | T4 | slice 3 |
| 5 | `feat/members-abm-05-list` | T5 | slice 4 |
| 6 | `feat/members-abm-06-form` | T6 | slice 5 |

## Tasks
- [x] T1 — Backend test runner + shared JSON store. Add Vitest to the backend. Implement `backend/src/database/json-store.ts`: read with a default value, atomic write (temp file + rename), serialized writes per file. Tests cover missing file, round trip, concurrent writes without corruption. Route: delegated direct writer. Acceptance: tests, build and typecheck pass; helper documented for the teammate.
- [x] T2 — Members domain + repository. Member types, validation (required fields, DNI format and uniqueness, valid birthDate, category enum, guardian required for minors), service (create with auto memberNumber, update, deactivate with date/reason, reactivate), `MemberRepository` interface and JSON implementation. Route: delegated direct writer. Acceptance: rule tests written first and passing.
- [x] T3 — Members HTTP API. Routes/controller under `/api/members`: list (search by name/DNI, filter by status), get by id, create, update, deactivate, reactivate. Errors map to 400 (validation), 404 (not found), 409 (duplicate DNI). Synthetic seed data. Vite dev proxy `/api` → backend. Route: delegated direct writer. Acceptance: API tests against an ephemeral-port server pass; manual smoke check.
- [x] T4 — Frontend design base. Add Vitest + Testing Library to the frontend. Design tokens, fonts, and the app shell (sidebar + header) matching the beta. Route: delegated direct writer. Acceptance: shell renders; tests, build and typecheck pass.
- [ ] T5 — Members list screen. Table (number, name + category + age, DNI, member since, status chip), search, filter tabs (All / Active / Inactive), "Alta de socio" action, loading/empty/error states. Route: delegated direct writer. Acceptance: component tests pass; works against the real API in the browser.
- [ ] T6 — Create/edit form, detail, deactivate/reactivate. Shared form with client validation mirroring the backend, guardian fields shown for minors, member detail view, confirmation dialog with reason for deactivation, reactivation. Route: delegated direct writer. Acceptance: component tests pass; full ABM flow verified in the browser.

## Applicable checks
- `pnpm --filter <package> test` (TDD evidence per task).
- `pnpm -r build` and `pnpm -r typecheck`.
- Backend smoke check against `/api/members`; browser check of the UI flows for T5–T6.
- Gentle-AI review assessment after each work-unit commit (RDD on by default).
- `git status` and commit readback after each task.

## Progress
- 2026-10-05: Decisions recorded; branch `feat/members-abm` created from `manu`. Chain strategy chosen: feature-branch-chain. Plan commit `d105d76` (Gentle-AI: low risk, approved and acknowledged).
- T1 (delegated writer, slice 1): `createJsonStore<T>(filePath, defaultValue)` with `read`/`update`; atomic temp-file + rename; per-path promise queue shared across instances; invalid JSON throws without touching the file. RED: `pnpm --filter @club-socios/backend test` failed with `Cannot find module '../src/database/json-store.js'`. GREEN: 11/11 tests passed (re-run by the parent: 11/11). `pnpm -r build` and `pnpm -r typecheck` passed. ~198 authored lines. Follow-up: backend `tsc` does not typecheck `tests/` (tsconfig includes only `src`); Vitest strips types without checking them. `pnpm` is only available through `corepack pnpm` on this machine. Rollback: remove `json-store.ts`, its test, the vitest devDependency and the handoff section.

- T1 committed as `976b32d`. Gentle-AI review (consent granted by the user, lineage `review-f0e8cf7976115228`, base `3f7c2ed`, plan + T1, 422 lines, medium risk, reliability lens): approved and acknowledged; reviewed boundary is now `976b32d`. Non-blocking findings recorded as follow-up work:
  - WARNING `R3-undefined-write`: an updater that returns `undefined` writes the text `undefined` and bricks the store. Reject non-serializable results before writing, with a test.
  - SUGGESTION `R3-write-failure-untested`: cover the temp-file cleanup when rename fails (plausible EPERM/EBUSY on Windows).
  - SUGGESTION `R3-default-clone-untested`: prove the default value is cloned.
  - SUGGESTION `R3-vitest-range`: pin vitest exactly, matching the repo convention.

- T1 follow-up fixed on slice 1 (delegated writer, user-approved): `writeAtomically` rejects values `JSON.stringify` cannot serialize, before any file work (RED: "promise resolved undefined instead of rejecting"; GREEN). Characterization tests (passed on first run) for rename-failure cleanup and default-value cloning. vitest pinned to `5.0.3`. Backend `typecheck` now uses `tsconfig.test.json` (src + tests, noEmit); `build` still emits only `src`. Evidence: backend tests 14/14 (parent re-run 14/14), backend typecheck passes with tests, `pnpm -r build` and `pnpm -r typecheck` pass. ~55 authored lines.

- T1 follow-up committed as `34fe80e` (Gentle-AI assess vs `976b32d`: medium, under budget). A granted review of plan + T1 + follow-up (lineage `review-02af8af56334cbb0`) could not start: `invalid_request`, because T2's untracked files were present. Nothing was mutated. Lesson: do not start the next task in the same worktree while a review is pending.
- T2 (delegated writer, slice 2): `MemberRepository { list, mutate(change) }`. The JSON implementation runs DNI check, number allocation and write inside one `store.update`. The service depends only on the interface and uses an injected clock. Error classes are in `backend/src/shared/errors.ts`. Writer assumptions, beyond those listed in the user-facing summary:
  - `update` fully replaces personal fields; `email`/`guardian` are cleared if omitted.
  - A partially filled guardian on an adult is validated.
  - Search matches "first last", "last first" and DNI digits, accent-insensitive.
  - Phones are stored normalized.
  - Guardian error keys are `guardian.name`/`guardian.contact`.
  - Member rules (user-confirmed 2026-10-05): adulthood at 18, WhatsApp required, DNI 7–8 digits unique including inactive members, numbers never reused, category not validated against age, reactivation drops the previous deactivation record.
- T2 evidence: RED = 2 test files failed with "Cannot find module ... errors.js / json-member.repository.js" while the 14 existing tests passed. GREEN = 76/76 (parent re-run 76/76). Backend typecheck, `pnpm -r build` and `pnpm -r typecheck` pass. Authored: 841 lines (src 325, tests 518), over the ~400 slice budget. One slicing pass found no cohesive split, since the tests verify the rules in the same unit. Recommend `size:exception` for slice 2.

- T2 committed as `5b132dc`. Gentle-AI review (consent granted, lineage `review-912b9c3782c03dfb`, base `976b32d`, T1 follow-up + T2, 927 lines, medium, reliability lens): approved and acknowledged; reviewed boundary is now `5b132dc`. Non-blocking findings (pending):
  - WARNING `R3-update-clears-optional-untested`: no test proves `update` clears omitted email/guardian.
  - SUGGESTION `R3-search-digit-extraction`: a name query with one digit matches every DNI containing it.
  - SUGGESTION `R3-member-number-nan`: a non-numeric stored `memberNumber` makes every later number `NaN`.
  - SUGGESTION `R3-local-tz-today`: "today" (future-date checks, 18th-birthday cutoff, deactivation date) depends on the server timezone. Feb 29 birthdays are untested.

- T2 follow-up fixed on slice 2 (delegated writer, user-approved). Club date uses `CLUB_TIME_ZONE = 'America/Argentina/Tucuman'` (`backend/src/config/club.ts`) via `Intl.DateTimeFormat`. In non-leap years, a Feb 29 birthday counts as March 1. Changes:
  - The DNI search path runs only for digit/dot/space/dash queries.
  - Invalid stored member numbers are ignored.
  - New tests cover update clearing email/guardian (characterization, green on first run).
  - RED evidence: "Rocío 2" matched an unrelated member; the next number was `0NaN`; 3 failures under `TZ=UTC`.
  - GREEN: 88/88 under the default TZ, UTC, Asia/Tokyo and America/Los_Angeles; the parent re-ran default and UTC, both 88/88. Typecheck and build pass. ~150 authored lines.

- T2 follow-up committed as `6161321`. Gentle-AI review (consent granted, lineage `review-9e4f5ce93841b82d`, whole branch from `3f7c2ed`, 1,479 lines, medium, reliability lens): approved and acknowledged. One pending suggestion, `R3-adhoc-context-cleanup-not-guaranteed`: member service tests call cleanup inline instead of in `finally`/`afterEach`, so temp dirs leak only when a test fails.
- T3 (delegated writer, slice 3):
  - `createApp({ memberService })` keeps `/health`, uses `express.json({ limit: '100kb' })` and mounts `/api/members`; the auth insertion point is marked.
  - Six routes, no delete route. Shared `errorHandler`/`apiNotFound` map errors to 400 `validation_error`/`invalid_json`, 404 `not_found`, 409 `conflict`, 413 `payload_too_large` and 500 `internal_error` (no internals leaked).
  - Data file is `MEMBERS_FILE`, default `backend/data/members.json`; it is gitignored and only `members.seed.json` is versioned.
  - Seed: `corepack pnpm --filter @club-socios/backend seed [--force]` loads 8 synthetic members through the service (1 inactive via `deactivate`). Vite proxies `/api` to `http://localhost:3001`. README updated.
- T3 evidence:
  - RED: 15 failures (`createApp is not a function`, seed module missing). GREEN: 106/106 (parent re-run 106/106).
  - Typecheck and build pass.
  - Smoke check: `/health` 200; `GET /api/members` 200 with 8 members; `search=rios` 1 member; invalid POST 400.
  - ~565 authored lines (tests 253, seed JSON 80, README 28); over the advisory budget. The cohesive unit is the API with its tests.
  - Known: backend `build` also emits `dist/scripts/seed.js` (intended; the seed runs from `dist`).

- T3 committed as `277270c`. Gentle-AI review (consent granted, lineage `review-61d74b99a33402ac`, 550 lines, medium, reliability lens): approved and acknowledged; reviewed boundary is now `277270c`. Non-blocking findings:
  - WARNING: forced seed not atomic.
  - WARNING: 413 untested and missing from the README.
  - SUGGESTION: `MEMBERS_FILE` resolution untested.
  - SUGGESTION: other client body-parser errors return 500.

  A later whole-branch candidate (since `3f7c2ed`, 2,025 lines, already reviewed piece by piece) was declined by the user for that candidate only.
- T3 follow-up (user-approved) for those findings plus the T2 cleanup suggestion. The writer was stopped on 2026-10-05 at the user's request ("espera y guarda"), just before its build and typecheck step. Uncommitted work remains on `feat/members-abm-03-api`: `README.md`, `error-handler.ts`, `member.seed.ts`, `scripts/seed.ts`, `tests/members/{helpers,member.api,member.seed,member.service}.test.ts`, and new `backend/tests/config/`. The parent ran the backend tests (113/113) and the backend typecheck, and both passed. Not yet done:
  - review of the diff by the parent;
  - RED evidence (unknown, since the writer's report was never received);
  - `pnpm -r build` and the runtime smoke check;
  - commit and Gentle-AI review.

  Resumed 2026-10-05 (session 2). The parent's diff review confirms all five findings are addressed:
  - forced seed: builds on an in-memory scratch repository through the service, then writes the target once;
  - 413 test and README;
  - `paths.test.ts`;
  - `clientError` maps exposed 4xx errors to `bad_request`;
  - `trackContexts` with `afterEach` cleanup.

  Checks: `corepack pnpm -r typecheck` passes; `corepack pnpm -r build` passes; backend tests pass 113/113. The smoke check against a scratch `MEMBERS_FILE` passed: seed 8, re-seed refused with exit 1, `--force` reseeded 8, GET list returned 8, unknown id returned 404 `not_found`, bogus charset returned 415 `bad_request`. RED evidence stays unknown and is disclosed as such.

  - Committed as `84cb0d4`. `gentle-ai review assess --base-ref 277270c --committed-only` returned medium risk (`executable_change`, `error-handler.ts`, 193 lines) with `review_due` false (`under_budget`). The slice stays pending from boundary `277270c` until a later commit reaches the budget.

- T4 (2026-10-05, route: delegated direct writer, because it touches 2+ non-trivial files). TDD evidence:
  - RED: `AppShell.test.tsx` failed with "Failed to resolve import ./AppShell"; `App.test.tsx` could not find the navigation landmark.
  - GREEN: 7/7, confirmed by the parent's re-run.

  Checks:
  - `pnpm -r typecheck`: pass.
  - `pnpm -r build`: pass.
  - Backend tests: 113/113.

  Decisions:
  - Exact pins: vitest 5.0.3, @testing-library/react 16.3.3, jest-dom 7.0.1, user-event 14.6.7, jsdom 30.1.2.
  - No router; the "Socios" link points to `/`.
  - No user/date block in the header, because it depends on the teammate's auth.

  About 360 authored lines.
- 2026-10-05: The user granted consent for the whole-branch candidate (since `3f7c2ed`, lineage `review-5aeb309a84828b1b`). START failed `invalid_request` with `not_started`, because the T4 writer's untracked files were present. Re-run STATUS after the T4 commit.

## Next step
1. Re-run Gentle-AI STATUS after the T4 commit and follow its transition. A new candidate needs fresh consent.
2. Then T5 (members list) on `feat/members-abm-05-list`.
