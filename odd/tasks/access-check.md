# Access check by DNI (RF-08)

## Objective
At the entrance, staff type a member's DNI and see at once whether the member may enter: green, yellow or red.

## Problem and why
RF-08 (Deseable): "Verificar por DNI si un socio está habilitado (al día) para ingresar (control de acceso básico)." The survey report links it to replacing the physical membership card: phase 1 is this basic check, phase 2 is biometrics. Today staff can only find out by opening Cobros.

## Scope
- In:
  - `POST /api/access/check` with `{ dni }` in the body, so the DNI never travels in a URL.
  - The capability `access:check` for secretary and head secretary.
  - A fast "Ingreso" screen: one DNI field, focused and ready for the next entry, and a large colored result.
- Out:
  - A log of entries.
  - Biometrics.
  - Turnstiles or other hardware.
  - Per-discipline schedules.

## Decisions
- User, 2026-11-05:
  - Green: the member is up to date and enters.
  - Yellow: the member owes 1 to 3 months, enters, and staff see the debt.
  - Red: the member is deregistered, inactive, or the DNI is unknown, and does not enter.
- ~~User, 2026-11-05: the entrance check shows paid-through or debt-since months, never a due day, because the club has not defined when a fee falls due (pending question 8).~~ Superseded by the next line.
- User, 2026-11-05: an up-to-date member sees the exact due date: the last day without surcharge of the first unpaid month, taken from the surcharge tiers in force for that month. Provisional until the club answers pending question 8.
- Provisional, not confirmed by the club:
  - Only secretaries and the head secretary use it, because there is no doorkeeper role.
  - A check stores nothing, so it is not audited.
  - The result shows the member's name, member number and unpaid months, and no amounts. An unknown DNI shows only "no registrado".

## Constraints
- Reuse the existing standing rules (`owedConcepts`, `accountStanding`) and the member DNI lookup. Do not duplicate or change payment rules.
- Read stores once per check.
- The DNI must not appear in logs, URLs or error messages.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English. Synthetic data only.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`. Every behavior task records observed RED, GREEN, REFACTOR.

## Delivery
Work on `manu` (user preference). Forecast is about 500 authored lines in two work-unit commits. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Backend access check. Route: delegated direct writer.
  - `backend/src/modules/access`, `POST /api/access/check`, `access:check`, wiring, route-matrix row, and the audit coverage list updated to treat this route as read-only. Add `tests/access` to the backend test script.
  - Acceptance:
    - The result is green, yellow or red with a reason code.
    - Each of these cases is tested: up to date, 1 month owed, 3 months owed, deregistered, inactive, unknown DNI, and invalid input.
    - A teacher gets 403.
    - No DNI appears in responses for an unknown member or in logs.
- [x] T2 — Frontend "Ingreso" section. Route: same writer.
  - Acceptance:
    - Visible to secretary and head secretary.
    - The DNI field is focused, Enter checks, and the field clears and refocuses for the next person.
    - Large green, yellow or red result that carries text as well as color.
    - Loading and error states.
- [x] T3 — Paid-through or debt-since month. Route: delegated direct writer.
  - Acceptance:
    - Up to date (green): "Pagado hasta <month> <year>", the latest month at or after the current one with nothing owed from the start through it. Found by extending the as-of month of the existing `owedConcepts` up to 12 months. When nothing falls due within those 12 months (for example, no active discipline), no month is shown.
    - Debtor (yellow) and deregistered (red): "Debe desde <month> <year>", the oldest unpaid period.
    - Inactive and unknown DNI: no dates.
    - API: `paidThrough?` and `debtSince?` (`YYYY-MM`) inside `member`; the frontend formats the month names.
- [x] T4 — Exact due date for up-to-date members. Route: delegated direct writer.
  - Acceptance:
    - Green with `paidThrough` P: `dueDate` is the day before the first surcharge tier with an amount above zero starts, in month P+1, clamped to the month length. With no charging tier it is the last day of P+1. Defaults and P = 2026-12 give 2027-01-10.
    - The pure helper `lastDayWithoutSurcharge` lives in `payments/pricing.ts`; no pricing rule is duplicated.
    - Green without `paidThrough`, yellow and red: no `dueDate`.
    - API: `dueDate?` (`YYYY-MM-DD`) inside `member`. UI: "Vence el dd/mm/aaaa" under "Pagado hasta …".

## Checks
- `pnpm --filter @club-socios/backend test`, `pnpm --filter @club-socios/backend typecheck`, `pnpm --filter @club-socios/frontend test`, `pnpm --filter @club-socios/frontend typecheck`.
- Browser check with synthetic members.

## Open items
- Owners: whether a doorkeeper role or a log of entries is wanted, and question 1 of the pending list (a deregistered member who pays).

## Progress
- 2026-11-05: rule decided with the user; this document created.
- 2026-11-05: T1 done. RED: `tests/access` failed (the access module did not exist; `POST /api/access/check` answered 404 instead of 400) and `permissions.test.ts` failed (`permissions[capability] is not iterable` for `access:check`). GREEN: `pnpm --filter @club-socios/backend test` 58 files, 978 tests passed; backend typecheck clean. REFACTOR: `earliestTariffPeriod` moved to `payments/pricing.ts` and reused by payments, notices and access. The member lookup scans `members.list()` once per check (no DNI index exists); acceptable at club size.

- 2026-11-05: T2 done. RED: `AccessView.test.tsx` failed with `Failed to resolve import "./AccessView"`, `sections.test.ts` and two `App.routing.test.tsx` cases failed (no `access` section, heading "Ingreso" not found). GREEN: `pnpm --filter @club-socios/frontend test` 47 files, 514 tests passed; frontend typecheck clean. REFACTOR: none needed. One backend run hit 2 failures in `tests/audit/audit.api.test.ts` (`fetch failed: bad port`, a random listen port that fetch blocks); two reruns passed 978/978, unrelated to this feature.

- 2026-11-05: Gentle-AI review of `a12bd7c`..`bf731bd` (lineage `review-81d368c910ce106d`, 31 files, 850 lines, high risk, consent granted): approved and acknowledged.
  - Fixed after the review: `R3-input-cleared-after-pending-check`. A DNI typed while a check is pending is no longer cleared by that check's answer. RED: the new test expected `40222333` but the field was empty. GREEN: the access view 14/14 and frontend typecheck clean.
  - Suggestions left for later: `R2-cross-feature-network-message`, `R2-hardcoded-yellow`, `R2-yellow-threshold-comment`, `R3-generic-error-branch-untested`, `R3-standing-boundaries-untested`.
- 2026-11-05: browser check at `/ingreso` as `secretary@club.test`.
  - The DNI field is focused on arrival.
  - `99000001` shows "No puede ingresar — dado de baja" with name and number.
  - `99000007` shows "No puede ingresar — inactivo".
  - `99999999` shows "No puede ingresar — DNI no registrado" with no member data.
  - After each answer the field is cleared and focused.
  - `12` shows the 7–8 digit message and keeps the input.
  - Green and yellow were not seen in the browser: every synthetic member owes 11 months. They are covered by tests.
  - The pane would not draw, so the checks were submitted through the form by script instead of keystrokes.

- 2026-11-05: T3 done. RED: backend `access.service.test.ts` 6 failed (for example `expected { memberNumber: 'N-free', …(2) } to match object { paidThrough: '2027-11' }`, and the deregistered answer lacked `"debtSince": "2026-06"`); frontend `AccessView.test.tsx` 3 failed (`findByText('Debe desde septiembre 2026')` and `'Pagado hasta octubre 2026'` found nothing). GREEN: backend access 21/21 and frontend access 18/18. REFACTOR: the debt branch builds one summary shared by yellow and red; the month line is computed once in the view. A first GREEN attempt gave an inactive member `debtSince`; the test caught it and inactive now returns no dates. Known edge: a member with no active discipline owes nothing ever, so shows the 12-month bound as paid-through; decision gap for the owners.
- 2026-11-05: parent follow-up to T3: a member with nothing due within the 12-month window showed "Pagado hasta" the window's last month, which misleads. That month is now omitted. RED: the new test expected no `paidThrough` and got `2027-11`. GREEN: access tests 21/21 and backend typecheck clean.
- 2026-11-05: Gentle-AI review of `1d0e692`..`e5b1ffe` (lineage `review-cc718c58f9afe758`, 9 files, 146 lines, medium risk, consent granted): approved and acknowledged.
  - Later work: `R3-paid-ahead-window-conflation`. A member paid 12 or more months ahead also shows no month, the same as one with nothing due.
  - Suggestions: `R3-debtsince-ordering-assumption` and `R3-monthlabel-unvalidated`.
  - Browser, as `secretary@club.test` (form submitted by script): `99000001` and `99000004` show "Debe desde enero 2026", and `99000007` (inactive) shows no month. "Pagado hasta" is covered by tests only, because no synthetic member is up to date.
- 2026-11-05: T4 done. RED: backend 4 failed (`expected { memberNumber: 'N-ok', …(3) } to match object { paidThrough: '2026-12', …(1) }` and the three sibling cases); frontend `AccessView.test.tsx` 1 failed (`Unable to find an element with the text: Vence el 10/01/2027`). GREEN: backend access 27/27 (the existing green case now expects `dueDate: '2026-12-10'`) and frontend access 20/20. REFACTOR: the nested block in the service was flattened. Tiers carry no effective date, so "in force for that month" means the configured tiers. Decision gap: a tier charging from day 1 leaves no free day; the date is then the 1st.
- 2026-11-05: Gentle-AI review of `a281636`..`0f3e45d` (lineage `review-41a080c6a09552df`, 9 files, 113 lines, high risk, consent granted): approved and acknowledged.
  - Warnings, later work: `R2-last-day-without-surcharge-misnamed-edge` and `R3-due-date-day1-tier-surcharged`. If a tier charges from day 1, the date shown is the 1st, although that day is already surcharged. The default tiers do not hit this.
  - Suggestions: see the review record.
  - Browser, as `secretary@club.test` (form submitted by script): `99000005`, paid through December 2026, shows "Pagado hasta diciembre 2026" and "Vence el 10/01/2027".

## Next step
The owners' open items. Push is the user's decision.
