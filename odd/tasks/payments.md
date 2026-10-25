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
- P2 — Backend role-based authorization. `requireAuth` only checks the session and protects `/users`; `role` is a free `string` on users and members/disciplines are still open. Needed before T5–T6 (annulment) and T3 (configuration writes). Confirm the exact role names, including "Head of Secretariat", with the owners and the teammate who owns `users`.

## Tasks
- [x] T1 — Pricing domain (pure). Types for `Money`, `Tariff` (with effective date), `SurchargeTier` and `ProrationRule`, plus functions that resolve the tariff in force for a period, the surcharge for a payment day, and the new-member proration. Tests cover the handbook examples ($60,000; $63,000; $66,000; $70,000; $74,000; $50,000; $60,000 new-member; $20,000 added activity), day 31, and a tariff change between two months. Route: delegated direct writer. Acceptance: tests written first and passing; no I/O.
- [x] T2 — Charge calculation. `calculateCharge(member state, enrolled disciplines, payment date, selected concepts)` returns line items (enrollment, social fee, activity fee per discipline, surcharge per activity, carnet) and a total. Handles: new vs existing member, proration, added activity, overdue months at their own tariff, deregistration after more than 3 unpaid months. Route: delegated direct writer. Acceptance: table-driven tests from the handoff examples; paying one concept never settles another.
- [ ] T3 — Configuration domain and API. Repository (JSON, `config.json`) for tariffs with effective dates, surcharge tiers, proration rule, discounts and promos; admin-only routes to read and update; validation that rejects overlapping or gapped tiers and negative amounts. Route: delegated direct writer. Depends on P2. Acceptance: API tests including a non-admin being rejected; a tariff edit does not change already-issued payments.
- [ ] T4 — Memberships (member to discipline enrollment). Domain, repository and API linking a member to disciplines with start date and status, so T2 knows which activities a member owes. Route: delegated direct writer. Acceptance: tests first; a member can enroll in and leave a discipline; inactive members are excluded. Confirm the module is not already owned by a teammate before starting.
- [ ] T5 — Payments domain and repository. Append-only payment records with line items, method (cash, debit, QR, transfer), atomic correlative receipt number, annulment record (reason, author), and derivation of unpaid concepts, balance and member status (up to date, debtor, deregistered). Route: delegated direct writer. Depends on T2 and T4. Acceptance: receipt numbers never repeat under concurrent writes; balance recomputes after payment and after annulment.
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
- Whether `memberships` is owned by the teammate (T4).

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

## Next step
1. Ask the owners what happens to the old debt when a deregistered member re-registers.
2. Next tasks: T4 (memberships; confirm ownership with the teammate) or P2 (role authorization) before T3/T5/T6.
3. In parallel, ask the teammate about P1/P2 status and ownership of `memberships`.
