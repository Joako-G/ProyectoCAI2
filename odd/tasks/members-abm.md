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
- [ ] T3 — Members HTTP API. Routes/controller under `/api/members`: list (search by name/DNI, filter by status), get by id, create, update, deactivate, reactivate. Errors map to 400 (validation), 404 (not found), 409 (duplicate DNI). Synthetic seed data. Vite dev proxy `/api` → backend. Route: delegated direct writer. Acceptance: API tests against an ephemeral-port server pass; manual smoke check.
- [ ] T4 — Frontend design base. Add Vitest + Testing Library to the frontend. Design tokens, fonts, and the app shell (sidebar + header) matching the beta. Route: delegated direct writer. Acceptance: shell renders; tests, build and typecheck pass.
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
  - Parent-chosen rules (pending user confirmation): adulthood at 18, WhatsApp required, DNI 7–8 digits unique including inactive members, numbers never reused, category not validated against age, reactivation drops the previous deactivation record.
- T2 evidence: RED = 2 test files failed with "Cannot find module ... errors.js / json-member.repository.js" while the 14 existing tests passed. GREEN = 76/76 (parent re-run 76/76). Backend typecheck, `pnpm -r build` and `pnpm -r typecheck` pass. Authored: 841 lines (src 325, tests 518), over the ~400 slice budget. One slicing pass found no cohesive split, since the tests verify the rules in the same unit. Recommend `size:exception` for slice 2.

## Next step
Commit T2, run the pending Gentle-AI review, then T3 on `feat/members-abm-03-api` only after that review closes.
