# Payments and transactions

## Objective
Let the club secretariat register member payments end to end: look up a member by DNI, see what is owed, collect enrollment, social fee, activity fees, surcharges and carnet replacement, issue a numbered receipt, and keep every member's balance and status accurate. Tariffs and rules are editable by an administrator in a configuration section instead of being hardcoded.

## Problem and rationale
`modules/payments` and `modules/memberships` (backend) and `features/payments` (frontend) are reserved folders with no behavior. The owner clarified the business rules in conversation on 2026-10-25 and they are recorded in `docs/team-handoff.md` (commit `c2fba42`, section "Enrollment and payment rules agreed so far"). That handoff is the rules source for this feature. The approved requirements PDFs still hold older amounts, so the owners must confirm the handoff before release (see Open items).

## Rules in force (summary; `docs/team-handoff.md` is authoritative)
- Enrollment `$20,000` once per member. Social fee `$20,000` once per member and month. Activity fee `$20,000` per discipline and month. Carnet: first free, replacement `$3,000`.
- Late surcharge per activity by payment day: 1–10 `$0`, 11–15 `$3,000`, 16–20 `$5,000`, 21 onward `$7,000` (day 31 included). Surcharges do not accumulate across months.
- New member after the 15th: enrollment and social fee in full, each activity at half. The social fee is never discounted. Cutoff day and percentage are configuration.
- Existing member adds an activity mid-month: full activity fee, no second social fee.
- Overdue months are charged at the tariff in force for that month. More than 3 unpaid months means deregistered; re-registering is paid as a first-time member, enrollment included.
- No partial payments and no credit. Payment methods: cash, debit, QR (transfer is mainly rentals). Payments are never deleted; an annulment needs a reason and is restricted to the Head of Secretariat.

## Decisions
- Rules and configuration scope (user-confirmed, 2026-10-25): see handoff. Configuration section covers tariffs, surcharge tiers, proration (cutoff day, percentage), discounts, promos and price increases. Every tariff has an effective date so past and overdue periods keep their price.
- Money is stored as integer pesos, never as a decimal number.
- Balances and member status are derived from charge lines and payments, not stored as editable fields.
- Payments are append-only. An annulment is a new record with reason, author and date.
- Persistence follows the project pattern: JSON files behind a repository interface (`createJsonStore`), one file per module. Demo only.

## Authorized scope and constraints
- Edit only this repository, directly on branch `manu` (user decision, 2026-10-25: no new branch). No push, pull request or remote operation without explicit authorization.
- Synthetic data only. No real club records or credentials.
- Do not implement biometric access or PostgreSQL.
- Do not encode a rule that is not in the handoff or the approved requirements; stop and ask instead.
- TDD: ON. Source: explicit user choice for this project (Engram decision "TDD on with Vitest for club-socios", reused by `members-abm`). Runner: Vitest per package, `corepack pnpm --filter <package> test`. Every behavior task records observed RED, then GREEN, then REFACTOR.
- Delivery strategy: ask-on-risk, resolved as `exception-ok`. Forecast: about 3,500–4,500 authored changed lines across all tasks, above the ~400-line budget. User decision (2026-10-25): work-unit commits directly on `manu`, no feature branch and no chain; the user decides any later push or PR.
- Never stage `.atl/` registry files (machine-local; see review finding `R3-registry-machine-local`).

## Prerequisites (outside this feature; verify before the tasks that need them)
- P1 — Frontend routing and authentication-based route protection (listed as unfinished in the handoff). Needed before T7 and T8.
- P2 — Backend role-based authorization. Decided (user, 2026-10-25): roles `secretary` (Secretaria: everything except cash count, annulling payments and users/tariffs/configuration), `head_secretary` (Jefa de secretaría, the administrator: everything) and `teacher` (Docente: roster of their own disciplines, task T9). Tesorería and the `member` login role are dropped. Route policy: 401 without a session, 403 for a role that is not allowed. Existing `member` → `secretary` and `admin` → `head_secretary` when users are read.
- P2 done (2026-10-25, route: delegated direct writer, because it touches 2+ non-trivial files):
  - Files: `backend/src/modules/auth/permissions.ts` (capability → roles map, including future payments/config capabilities), `backend/src/middlewares/require-role.ts` (`requireRole`, `requireCapability`, `requireCapabilityByMethod`), `app.ts` guards on `/users`, `/api/members`, `/api/disciplines`, `/api/memberships`; users module accepts only the three roles and maps legacy roles on load; demo users `demo@club.test` (head_secretary), `secretary@club.test`, `teacher@club.test`; frontend role type, labels and select options. Route tests sign in through a temp users file. `require-auth.ts` was deleted in the follow-up.
  - RED: "Cannot find module '../../src/modules/auth/permissions.js'", "expected 'admin' to be 'head_secretary'", legacy roles accepted on create; frontend "Unable to find an element with the text: Jefa de secretaría".
  - GREEN: backend 464/464 vitest and 18/18 node, frontend 235/235 (parent re-run); `pnpm -r typecheck`, `pnpm -r build` (writer) and `git diff --check` pass.
  - UI today (P1 not done): a secretary or teacher still sees the Usuarios link and gets the users error state (403); a teacher gets error states in Socios and Disciplinas; a secretary sees discipline edit buttons that fail with 403.
  - Local data: an old `backend/data/users.json` keeps `demo@club.test` as `member` → `secretary`; documented in `docs/team-handoff.md` (delete the file to reseed).
  - Committed as `0c34a02`. Gentle-AI review (consent granted, lineage `review-f886f97f2d3c5360`, base `6d36be6`, 28 files, 584 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `0c34a02`. Being fixed in a follow-up (user: continue the work): WARNING `R3-self-lockout` / `R4-lockout-recovery` (the last head secretary can demote or deactivate themselves and nobody can manage users), WARNING `R2-001` (unknown stored roles typed as `Role`), SUGGESTIONS `R3-legacy-proto-lookup`, `R2-002` (memberships read-only guard comment), `R2-004` (delete unused `require-auth.ts`), `R2-005` (matrix test should import `roles`). `R2-003`: the "Original P2 note" below is superseded history.
  - P2 follow-up (same writer): the user service rejects any update or deactivation that leaves zero active head secretaries (409 "At least one active head secretary is required"); startup warns when no active head secretary exists (nobody is promoted); legacy roles map through `Object.hasOwn`; stored `role` is typed `string`; `require-auth.ts` deleted; memberships guard comment; matrix test imports `roles`; the role select is disabled when editing the signed-in account. `docs/AI-CODING-GUIDE.md` updated (parent). RED: 5 backend tests failed (prototype lookup, last-head demote/deactivate, inactive-head count, startup warning) and 1 frontend test ("disables the role select when editing the signed-in account"). GREEN: backend 471/471 vitest and 19/19 node, frontend 237/237 (parent re-run); typecheck passes.
- Earlier review of `6d36be6` (lineage `review-590c447fff785e7b`): approved, suggestions only, kept as later work: keep the R3 traceability ID in the T4 scope note (`R3-t4-acceptance-inactive-unproved`); a subprocess test that the entrypoint exits 1 on a fatal bootstrap, preferring `process.exitCode`; a test that a throwing `listen` rejects `bootstrap`.
- T9 — Teacher roster (RF-20): link teacher users to their disciplines and expose the roster of members per discipline to them. After P2.
- Conflict to confirm with the owners before T5: RF-12 (Esencial) requires partial payments with a pending balance; the owner said partial payments are not accepted.
- Original P2 note (superseded history; see "P2 done" above): `requireAuth` only checks the session and protects `/users`; `role` is a free `string` on users and members/disciplines are still open. Needed before T5–T6 (annulment) and T3 (configuration writes). Confirm the exact role names, including "Head of Secretariat", with the owners and the teammate who owns `users`.

## Tasks
- [x] T1 — Pricing domain (pure). Types for `Money`, `Tariff` (with effective date), `SurchargeTier` and `ProrationRule`, plus functions that resolve the tariff in force for a period, the surcharge for a payment day, and the new-member proration. Tests cover the handbook examples ($60,000; $63,000; $66,000; $70,000; $74,000; $50,000; $60,000 new-member; $20,000 added activity), day 31, and a tariff change between two months. Route: delegated direct writer. Acceptance: tests written first and passing; no I/O.
- [x] T2 — Charge calculation. `calculateCharge(member state, enrolled disciplines, payment date, selected concepts)` returns line items (enrollment, social fee, activity fee per discipline, surcharge per activity, carnet) and a total. Handles: new vs existing member, proration, added activity, overdue months at their own tariff, deregistration after more than 3 unpaid months. Route: delegated direct writer. Acceptance: table-driven tests from the handoff examples; paying one concept never settles another.
- [x] T3 — Configuration domain and API. Done 2026-10-25 (route: delegated direct writer, because it touches 2+ non-trivial files):
  - Files: `backend/src/modules/payments/pricing-config.{types,repository,service,validation,routes}.ts` and `json-pricing-config.repository.ts` (`pricing-config.json`, env `PRICING_CONFIG_FILE`, missing file = T1 defaults); `pricing.ts` exports its asserts and adds `assertTariffs`; `config:read` capability (secretary, head secretary); `app.ts`/`server.ts` wiring; handoff note. Tests: `backend/tests/payments/pricing-config.{service,api}.test.ts`, matrix, permissions and paths tests.
  - Endpoints under `/api/pricing`: `GET /` (`config:read`), `POST /tariffs`, `PUT /tariffs/:effectiveFrom`, `DELETE /tariffs/:effectiveFrom`, `PUT /surcharge-tiers`, `PUT /proration-rule` (`config:manage`). Errors: 400 invalid input (including adding a past-month tariff), 404 unknown tariff, 409 duplicate `effectiveFrom`, replacing or deleting a past-month tariff, or leaving no tariff in force for the current month; a malformed file gives 500 and is left untouched. Extra body fields such as discounts are ignored.
  - `resolveForPeriod(period)` returns `{ tariff, surchargeTiers, prorationRule }` for T5.
  - RED: "Cannot find module '../../src/modules/payments/json-pricing-config.repository.js'", "pricingConfigFilePath is not a function", "permissions[capability] is not iterable". GREEN: backend 551/551 vitest and 19/19 node (parent re-run); `pnpm -r typecheck`, backend build and `git diff --check` pass.
  - No runtime smoke against the real server: no documented demo password and the server reads only the local users file; the API tests run a real HTTP server with a signed-in account per role.
  - About 580 authored lines (tests ~430).
  - Gaps: tiers and proration have no history, so T5 must snapshot amounts into each payment; the default tariff's `effectiveFrom` `2026-01` is assumed to be the start of the price history.
  - Decided (user, 2026-10-25): tariffs of past months are immutable, only the current month or later can be created or edited (a price rise is a new tariff with a later `effectiveFrom`); surcharge tiers and the proration rule are current configuration for charges made from then on; discounts and promos are out of T3 until the club defines them; reads need a session with `payments:collect` or `config:manage`, writes need `config:manage` (head secretary). Also record in this commit the review of `f97c7d0` (lineage `review-daeb6b4a5f1213a1`, approved, suggestions: rename the "self-demotion" service test or move it to HTTP; extract `isCurrentAccount` in `UserForm`). Original text: Repository (JSON, `config.json`) for tariffs with effective dates, surcharge tiers, proration rule, discounts and promos; admin-only routes to read and update; validation that rejects overlapping or gapped tiers and negative amounts. Route: delegated direct writer. Depends on P2. Acceptance: API tests including a non-admin being rejected; a tariff edit does not change already-issued payments.
- [x] T4 — Memberships (member to discipline enrollment). Scope change (reviews `R2-t4-acceptance-checked-but-unmet`, `R2-t4-checked-with-unmet-acceptance`): memberships ignore member status by design (no cascade rule yet), so "inactive members are excluded" moved to T5's acceptance. Original text, kept for history: Domain, repository and API linking a member to disciplines with start date and status, so T2 knows which activities a member owes. Route: delegated direct writer. Acceptance: tests first; a member can enroll in and leave a discipline; inactive members are excluded. Confirm the module is not already owned by a teammate before starting.
- [ ] T5 — Payments domain and repository. Append-only payment records with line items, method (cash, debit, QR, transfer), atomic correlative receipt number, annulment record (reason, author), and derivation of unpaid concepts, balance and member status (up to date, debtor, deregistered). Route: delegated direct writer. Depends on T2 and T4. Acceptance: receipt numbers never repeat under concurrent writes; balance recomputes after payment and after annulment; inactive members are excluded from owed periods (moved from T4, because memberships ignore member status).
- [ ] T6 — Payments HTTP API. Routes under `/api/payments`: preview a charge by member DNI, register a payment, get a receipt, list a member's history, annul a payment (Head of Secretariat only). Errors map to 400, 404, 403. Route: delegated direct writer. Depends on P2. Acceptance: API tests on an ephemeral port; manual smoke check.
- [ ] T7 — Payment flow UI. Under `features/payments/`: search by DNI, show unpaid periods and concepts, select what to pay, show the total with surcharge lines, choose the method, confirm, show the receipt. Loading, empty and error states. Route: delegated direct writer. Depends on P1. Acceptance: component tests; flow verified in the browser.
- [ ] T8 — Configuration UI. Admin-only screen to edit tariffs (with effective date), surcharge tiers, proration and promos, showing the change history. Route: delegated direct writer. Depends on P1 and T3. Acceptance: component tests; a non-admin cannot reach it.

## Applicable checks
- `corepack pnpm --filter <package> test` with TDD evidence per task.
- `corepack pnpm -r build` and `corepack pnpm -r typecheck`.
- Backend smoke check against `/api/payments` and the configuration routes; browser check for T7–T8.
- Gentle-AI review assessment after each work-unit commit (RDD on by default).
- `git status` and commit readback after each task.

## Open items
- The owners must confirm the handoff rules and update the approved requirements source (PDFs hold older amounts).
- Resolved (user, 2026-10-25): an overdue month carries only the surcharge for the day it is actually paid, with no extra for the missed month.
- Role names for the Head of Secretariat and administrator (P2).
- Whether the carnet replacement and discounts/promos need their own receipt line types beyond the concepts above.
- Resolved (user, 2026-10-25): `memberships` is owned by us, not by the teammate (T4).
- Decision (user, 2026-10-25, T4): `Member.disciplineIds` (commit `8b5efc7`) stays the single editable source. Memberships are the dated history derived from it: member create/update calls an idempotent sync through a port (open on add, end on remove), `/api/memberships` is read-only, and a startup reconcile backfills history using `memberSince` as the start date. A first T4 draft with its own enroll/end API was discarded because it duplicated the source of truth.

## Progress
- 2026-10-25: Rules clarified with the owner and committed in the handoff (`c2fba42`). This feature document created from `manu`; no source written yet.
- 2026-10-25, T1 (route: delegated direct writer, because it touches 2+ non-trivial files):
  - Files: `backend/src/modules/payments/pricing.types.ts`, `pricing.ts` (defaults, `assertMoney`, `resolveTariff`, `assertSurchargeTiers`, `surchargeForDay`, `prorateActivityFee`), `backend/tests/payments/pricing.test.ts`; `backend/package.json` adds `tests/payments` to the vitest list.
  - RED: `vitest run tests/payments` failed with "Cannot find module '../../src/modules/payments/pricing.js'".
  - GREEN: 45 payments tests; backend 260/260 vitest and 17/17 node tests (parent re-run 260/260). `pnpm -r typecheck`, `pnpm -r build` and `git diff --check` pass.
  - Environment: `corepack pnpm` now fails the inner `pnpm run build` with `ERR_PNPM_BAD_PM_VERSION` (pinned 11.6.0, corepack provides 12.9.1). Checks run with `pnpm_config_pm_on_fail=ignore corepack pnpm --pm-on-fail=ignore ...`.
  - Design choices: tiers are re-validated on every call; proration rounds half up to whole pesos; `activityPercent` is a whole number 0–100; `afterDay` is strict (enrolling on the 15th pays full); tariffs start on month boundaries (`YYYY-MM`).
  - About 371 authored lines.
  - Committed as `735fb70`. Gentle-AI review (consent granted, lineage `review-3f2b13461623542b`, base `48d9257`, committed only: handoff + plan + T1, 6 files, 470 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `735fb70`. Non-blocking SUGGESTION findings (later work):
    - `R3-duplicate-tariff-effective-from`: `resolveTariff` keeps the first of two tariffs with the same `effectiveFrom`, so the price depends on input order. Reject duplicates with a `ValidationError` and a test (do it before T3, since tariffs become admin-editable).
    - `R2-001`: name the `50`/`100` rounding constants in `prorateActivityFee`.
    - `R2-002`: the initial `amount = tiers[0].amount` in `surchargeForDay` is redundant.
    - `R2-003`: `Money` and `Period` are plain aliases, so the types do not enforce their invariants.
- 2026-10-25, T2 (route: delegated direct writer, because it touches 2+ non-trivial files; the parent made the follow-up rule fix inline):
  - Files: `backend/src/modules/payments/charge.ts` (`calculateCharge`), `charge.types.ts`, `standing.ts` (`isDeregistered`, threshold 3), `backend/tests/payments/charge.test.ts`. `resolveTariff` now rejects a duplicate `effectiveFrom` (fixes `R3-duplicate-tariff-effective-from`).
  - Input: tariffs, surcharge tiers, proration rule, club-local `paymentDate` (`YYYY-MM-DD`), optional `registration { enrollmentDate }` for a first-time registration, and concepts (enrollment, social fee per period, activity fee per period and discipline, carnet replacement). Output: line items (with separate surcharge lines) and an integer total.
  - Rejected: empty charge, duplicate concepts, enrollment without registration and the reverse, periods after the payment month, unknown concepts, empty discipline id.
  - Owner decision (2026-10-25) found by the parent's diff review: a new member's enrollment month is never surcharged (the writer had surcharged it, giving $70,000 instead of $60,000). Recorded in `docs/team-handoff.md`.
  - RED (writer): "Cannot find module '../../src/modules/payments/charge.js'"; duplicate tariff test "expected function to throw an error, but it didn't". RED (parent fix): "expected 70000 to be 60000" and "expected 63000 to be 60000".
  - GREEN: backend 308/308 vitest, 17/17 node; `pnpm -r typecheck`, `pnpm -r build` and `git diff --check` pass (with the pnpm workaround).
  - About 470 authored lines (source ~190, tests ~280), over the advisory budget because of the tests.
  - Rule gaps: old debt on re-registration after deregistration is unknown; whether `enrollmentDate` may be after `paymentDate`; only one carnet replacement per charge (writer's choice).
  - Committed as `0461a06`. Gentle-AI review (consent granted, lineage `review-d8c598013be3a7a3`, base `735fb70`, committed only, 8 files, 507 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `0461a06`. Non-blocking findings (later work):
    - WARNING `R3-enrollment-date-unbounded` and SUGGESTION `R4-001`: an `enrollmentDate` after the payment date, or activity periods before the enrollment period, are accepted and give an inconsistent charge. Reject them with a test.
    - WARNING `R2-001`: the `enrollment?.day ?? 1` fallback relies implicitly on the `isNewMember` gate.
    - SUGGESTION `R2-002`: `parseClubDate`'s comment understates what it returns.
    - SUGGESTION `R2-003`: proration and surcharge exemption share one `inEnrollmentPeriod` flag; split them into named rules.
- 2026-10-25, T2 findings fix (user-approved; route: direct inline, one source file plus its test):
  - `R3-enrollment-date-unbounded` / `R4-001`: `calculateCharge` rejects an `enrollmentDate` after the payment date with a `ValidationError`. Not done: rejecting periods before the enrollment period, because that depends on the open re-registration debt rule.
  - `R2-001`: the `enrollment?.day ?? 1` fallback is gone. The activity line computes `enrollmentDay` only for the enrollment month, and proration and the surcharge exemption read it explicitly.
  - RED: two new tests failed with "expected function to throw an error, but it didn't". GREEN: backend 311/311; `pnpm -r typecheck` and `git diff --check` pass.
  - Committed as `d2c3578`. Gentle-AI review (consent granted, lineage `review-6a4228ebfc0a909d`, base `0461a06`, 3 files, 46 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `d2c3578`. Non-blocking SUGGESTION findings (later work):
    - `R4-raw-string-date-order`, `R2-001`, `R3-string-compare-relies-on-format`: the guard compares the raw date strings, which is correct only because `parseClubDate` enforces zero-padded `YYYY-MM-DD` first. Compare the parsed values instead.
    - `R3-reject-assertion-unpinned`: the rejection tests only check `ValidationError`; assert the `enrollmentDate` field too.
- 2026-10-25, suggestions fix (user-approved; route: direct inline, one source file plus its test):
  - The enrollment guard compares the parsed `{ period, day }` values through `isAfter`, not the raw strings. `parseClubDate`'s comment now says it returns the period and day (also closes T2 `R2-002`).
  - The rejection tests assert `fieldErrors` equals `{ enrollmentDate: ... }`. They are characterization tests, green on first run. Mutation check: with the guard disabled, both fail (2 failed / 94 passed); restored, 96/96.
  - GREEN: backend 311/311; `pnpm -r typecheck` and `git diff --check` pass.
  - Committed as `951ee15`. Gentle-AI review (consent granted, lineage `review-4e735ad1dc8646a5`, base `d2c3578`, 3 files, 30 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `951ee15`. Non-blocking SUGGESTION findings:
    - `R3-cross-year-order-unpinned`: add one cross-year rejection case (December payment, January enrollment) and one cross-year acceptance case.
    - `R2-001`: the guard comment describes the old string comparison; keep only the rule.
- 2026-10-25, T4 (route: delegated direct writer, because it touches 2+ non-trivial files; reworked once after the parent found the duplicated source of truth):
  - Requirements found by the writer: RF-01/RF-04 (assign disciplines to a member), RF-24 (closed discipline list), RF-19/RF-20 (members per discipline), RF-05/RF-26 (deactivation, automatic status), RF-09/RF-10 (charge per discipline), RN-11 and Informe CU-10/CU-11. Nothing about capacity or schedules.
  - Files: `backend/src/modules/memberships/` (types, repository port, JSON repository on `memberships.json`, `membership.period.ts` with `activeDisciplineIdsForPeriod`, service with `syncMember`/`reconcile`/list/get, read-only routes `GET /api/memberships` and `GET /api/memberships/:id`); `backend/src/modules/members/discipline-history.ts` (port) and `member.service.ts` (calls it after create/update; a port failure is logged, not raised); `server.ts` (wires the adapter, runs `reconcile` before `listen`); `app.ts`, `config/paths.ts` (`MEMBERSHIPS_FILE`), `package.json` test list. Tests under `backend/tests/memberships/` and `backend/tests/members/member.discipline-history.test.ts`.
  - RED: "TypeError: service.syncMember is not a function"; "expected 500 to be 404" for POST; "expected vi.fn() to be called 1 times, but got 0 times" for the members port.
  - GREEN: backend 366/366 vitest (20 files) and 17/17 node (parent re-run); `pnpm -r typecheck`, backend build and `git diff --check` pass.
  - Runtime smoke (parent, scratch data files, port 3917): seed 6 disciplines and 8 members; startup reconcile created 11 memberships starting at each `memberSince`; `POST /api/memberships` returns 404. Server stopped.
  - About 800 authored lines (≈250 source, ≈550 tests), over the advisory budget because of the API and tests.
  - Gaps for the owners: no cascade on member deactivate/reactivate (payments must exclude inactive members); backfilled history starts at `memberSince` for every current discipline (real dates unknown); removals are dated on the edit day (RN-11 notice rule not encoded); an inactive discipline leaves existing memberships untouched; the seed script writes members without the port, so seeded data gets its history from the startup reconcile.
  - Committed as `9553eee`. Gentle-AI review (consent granted, lineage `review-b40e65e327c02656`, base `951ee15`, 20 files, 887 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `9553eee`. Non-blocking findings to fix before T5:
    - WARNING `R4-out-of-order-sync-race` / `R3-out-of-order-history-sync`: two concurrent updates of one member can write members A→B but sync history B→A, leaving history stale until restart.
    - WARNING `R4-swallowed-sync-misdates-history` / `R3-swallowed-history-failure-until-restart`: a failed sync is only logged; the restart reconcile then dates the fix with the restart day, so payments could charge a month not owed.
    - WARNING `R4-derived-file-blocks-startup`: a malformed `memberships.json` or a reconcile write error stops the whole server, including auth and members.
    - WARNING `R1-memberships-unauthenticated-read`: `/api/memberships` is open like members/disciplines; protect it with P2 before payments relies on it.
    - SUGGESTIONS: `R2-port-name-vs-call-site` (port is called on every save; document idempotency or rename), `R2-unused-query-helpers` (`listByMember`/`listByDiscipline` unused), `R3-startup-reconcile-untested` (extract and test the bootstrap).
- 2026-10-25, T4 resilience fix (user-approved; route: delegated direct writer, same writer):
  - Race: history syncs run on a per-member promise chain and re-read the member's current record, so out-of-order saves converge on the latest disciplines.
  - Dating: `Member.disciplinesChangedOn` (system-set, inside the same member write, changed only when the set of disciplines changes) is passed to the port; `reconcile` uses it instead of the restart day for members with history.
  - Startup: new `backend/src/startup.ts` `bootstrap` logs a failed reconcile and still listens. The port comment states it runs on every save and must be idempotent; `listByMember`/`listByDiscipline` were removed.
  - RED: "expected [ 'disc-basket' ] to deeply equal [ 'disc-volley' ]" (race), "expected 3 to be 1" (serialization), "expected undefined to be '2026-10-05'" (stamp), reconcile `endDate` mismatch, "Cannot find module '../../src/startup.js'".
  - GREEN: backend 377/377 vitest (21 files) and 17/17 node (parent re-run); `pnpm -r typecheck` and `git diff --check` pass.
  - Runtime smoke (parent, scratch files, port 3918, malformed `memberships.json`): server starts and logs the reconcile error; `/api/members` and `/health` return 200; `/api/memberships` returns 500; the broken file is left untouched. Server stopped.
  - Remaining gaps: members created before this change have no `disciplinesChangedOn`, so their repair falls back to the restart date; several changes during an outage collapse into the latest one; the sync chain is per process (fits the demo storage).
  - Committed as `2ac48ce`. Gentle-AI review (consent granted, lineage `review-e8a8c150bc69fc36`, base `9553eee`, 11 files, 379 lines, high risk, four lenses): approved and acknowledged; reviewed boundary is now `2ac48ce`. Findings:
    - WARNING `R4-bootstrap-swallows-primary-members-read`: a regression introduced by this fix (a broken `members.json` no longer stopped startup). Fixed right after (parent, inline): `bootstrap` reads the members outside the `try`, so only the reconcile degrades; `server.ts` adds a `.catch` that logs "Server failed to start" and exits 1 (also closes `R2/R3-bootstrap-floating-promise`). RED: "promise resolved "undefined" instead of rejecting". GREEN: 377/377, typecheck passes. Runtime: broken `members.json` exits 1 with nothing listening.
    - WARNING `R2-t4-checked-with-unmet-acceptance`: the unmet criterion moved to T5's acceptance.
    - SUGGESTIONS (later): `R1-001` add an update-path test that a client-supplied `disciplinesChangedOn` is ignored; `R4-serialized-sync-chain-no-timeout`; `R2/R3` timing-based drain helper in the out-of-order test.

## Next step
1. Ask the owners what happens to the old debt when a deregistered member re-registers.
2. Next tasks: T4 (memberships; confirm ownership with the teammate) or P2 (role authorization) before T3/T5/T6.
3. In parallel, ask the teammate about P1/P2 status and ownership of `memberships`.
