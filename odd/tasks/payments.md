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
- Edit only this repository, on branch `feat/payments` cut from `manu`. No push, pull request or remote operation without explicit authorization.
- Synthetic data only. No real club records or credentials.
- Do not implement biometric access or PostgreSQL.
- Do not encode a rule that is not in the handoff or the approved requirements; stop and ask instead.
- TDD: ON. Source: explicit user choice for this project (Engram decision "TDD on with Vitest for club-socios", reused by `members-abm`). Runner: Vitest per package, `corepack pnpm --filter <package> test`. Every behavior task records observed RED, then GREEN, then REFACTOR.
- Delivery strategy: ask-on-risk. Forecast: about 3,500–4,500 authored changed lines across all tasks, above the ~400-line budget. Chain strategy is not chosen yet; ask the user before the first commit of T1 (`stacked-to-main`, `feature-branch-chain` or a single PR into `manu` as done for members).

## Prerequisites (outside this feature; verify before the tasks that need them)
- P1 — Frontend routing and authentication-based route protection (listed as unfinished in the handoff). Needed before T7 and T8.
- P2 — Backend role-based authorization. `requireAuth` only checks the session and protects `/users`; `role` is a free `string` on users and members/disciplines are still open. Needed before T5–T6 (annulment) and T3 (configuration writes). Confirm the exact role names, including "Head of Secretariat", with the owners and the teammate who owns `users`.

## Tasks
- [ ] T1 — Pricing domain (pure). Types for `Money`, `Tariff` (with effective date), `SurchargeTier` and `ProrationRule`, plus functions that resolve the tariff in force for a period, the surcharge for a payment day, and the new-member proration. Tests cover the handbook examples ($60,000; $63,000; $66,000; $70,000; $74,000; $50,000; $60,000 new-member; $20,000 added activity), day 31, and a tariff change between two months. Route: delegated direct writer. Acceptance: tests written first and passing; no I/O.
- [ ] T2 — Charge calculation. `calculateCharge(member state, enrolled disciplines, payment date, selected concepts)` returns line items (enrollment, social fee, activity fee per discipline, surcharge per activity, carnet) and a total. Handles: new vs existing member, proration, added activity, overdue months at their own tariff, deregistration after more than 3 unpaid months. Route: delegated direct writer. Acceptance: table-driven tests from the handoff examples; paying one concept never settles another.
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
- Assumption to confirm in T2: when an overdue month is paid late, the surcharge is the one for the current payment day only, with no extra for the missed month.
- Role names for the Head of Secretariat and administrator (P2).
- Whether the carnet replacement and discounts/promos need their own receipt line types beyond the concepts above.
- Whether `memberships` is owned by the teammate (T4).

## Progress
- 2026-10-25: Rules clarified with the owner and committed in the handoff (`c2fba42`). This feature document created from `manu`; no source written yet.

## Next step
1. Choose the delivery chain strategy, then create `feat/payments` and start T1 (pure pricing domain, no dependency on P1 or P2).
2. In parallel, ask the teammate about P1/P2 status and ownership of `memberships`.
