# Team handoff: club membership system

This is the shared, version-controlled project context for collaborators and coding assistants. The repository contains working features beyond the original authentication and administration screens, payments included; see the boundaries below. A folder alone does not imply that its behavior is implemented.

## Quick path

1. Open this repository as the working directory. Install with `pnpm install`; verify with the relevant package tests, `pnpm build`, and `pnpm typecheck`.
2. Follow [`AGENTS.md`](../AGENTS.md): read relevant current sections of both requirements PDFs under `docs/` first, then [`AI-CODING-GUIDE.md`](AI-CODING-GUIDE.md), then inspect the owning code and tests.
3. Read this handoff as the portable source of team context. For a manual, per-machine Engram save, follow [the PowerShell instructions](../.engram/README.md). Markdown is **not** imported into Engram automatically; do not import parent-project history.

## Agreed boundaries

| Area | Current state and next boundary |
| --- | --- |
| Frontend | React + TypeScript + Vite. Existing feature areas: `access`, `audit`, `auth`, `backup`, `cashcount`, `disciplines`, `enrollment`, `expenses`, `faces`, `members`, `notices`, `payments`, `pricing`, `reports`, `roster`, and `users`; `memberships` is still an empty placeholder. Put feature code under `frontend/src/features/<feature>/`; use shared top-level folders only for genuinely cross-feature code. |
| Backend | Express + TypeScript. Existing modules: `access`, `audit`, `auth`, `backup`, `cashcount`, `disciplines`, `expenses`, `faces`, `members`, `memberships` (read-only routes), `notices`, `payments`, `reports`, `roster`, and `users`. New domain behavior belongs under `backend/src/modules/<feature>/`; follow the actual route/service/repository pattern without adding controller layers automatically. |
| Authentication and routing | Server-side sessions are implemented. Every backend route except `/auth` and `/health` now requires a session and a role allowed by `backend/src/modules/auth/permissions.ts` (401 without a session, 403 for a disallowed role). Roles: `secretary` (Secretaria), `head_secretary` (Jefa de secretaría, the administrator) and `teacher` (Docente; sees only the section "Mis disciplinas" with the current and past students of the disciplines the head secretary assigns to their account in the user form, via `GET /api/roster`, with name, member number and dates only). Old stored roles map `admin` → `head_secretary` and `member` → `secretary`. The frontend has capability-based routes and navigation (`frontend/src/layouts/sections.ts` and `frontend/src/App.tsx`). |
| Persistence and tests | Demo data uses JSON persistence and the session store is in memory; neither is production-grade storage. PostgreSQL is optional and holds only face profiles and the entrance log (see [`database.md`](database.md)). Frontend and backend have package test scripts; root provides build and typecheck, not a root test script. Use the exact commands in the coding guide. |
| Delivery | Keep work reviewable and agree on API contracts before wiring a new frontend flow to the backend. |

## Enrollment and payment rules agreed so far

These are current project-owner clarifications for the demo flow. The spreadsheet screenshots contain historical amounts; do not treat their `$15,000` values as current tariffs. The requirements PDFs still contain older amounts and open questions, so this handoff records newer clarifications without claiming every edge case is finalized. Revisit the relevant requirements and update their approved source when the club finalizes remaining policies.

| Concept | Current working rule |
| --- | --- |
| New member | Register by unique DNI. Charge a one-time enrollment fee of `$20,000`; adding another activity later does not charge enrollment again. |
| Monthly social fee | `$20,000` once per member and month. It may be paid with either activity or separately; do not force it to be attached to the first activity or a fixed payment order. |
| Activity fee | `$20,000` for each discipline in the current example. A second discipline adds its activity fee, not another social fee. |
| New-member proration | A new member enrolling after the 15th pays enrollment and the full social fee, plus **each activity fee at half** (`$10,000` instead of `$20,000`). The social fee is never discounted. The cutoff day and the percentage must be editable parameters (see [Next project work](#next-project-work)). |
| Added activity (existing member) | An existing member who adds an activity mid-month pays the full activity fee (`$20,000`). No second social fee and no proration. |
| Late surcharge | Apply per activity being paid, based on its payment date: days 1–10 `$0`; days 11–15 `+$3,000`; days 16–20 `+$5,000`; day 21 onward `+$7,000` (day 31 included; the last tier has no upper bound). Add the applicable surcharge to each late activity; do not apply just one surcharge when multiple activities are late. Surcharges never accumulate across months: only the one for the current payment date applies, also when paying an overdue month. A new member's enrollment month is never surcharged, because it had no earlier due date; the following months are surcharged like any member's. |
| Carnet | The first carnet is free. A replacement costs `$3,000`. |
| Overdue months | **Changed 2026-11-26, not implemented yet:** each overdue month is charged at the tariff in force on the **payment date** (the "monto actualizado" of the [club agreement](club-member-agreement.md)), not the tariff of the owed month. Tariff effective dates are still used for the current month and for price rises. The code today still prices by the owed month (`backend/src/modules/payments/pricing.ts`). |
| Deregistration | **Changed 2026-11-26, not implemented yet:** **2** unpaid months means deregistered (was "more than 3"), to match the club agreement. The threshold becomes an editable parameter in the pricing configuration instead of the constant in `backend/src/modules/payments/standing.ts`. Re-registering requires paying everything again as a first-time member, enrollment included. |
| Month without activity | **Added 2026-11-26, not implemented yet:** the secretary can mark a month as "sin actividad" for a member's discipline when the member did not attend; that month then owes only the social fee, not the activity fee. Any secretary may mark it (not only the head secretary), and only during that month, never afterwards. The system never infers absence on its own, because the entrance log is not a reliable record of attendance. |
| Partial payments | Not accepted (confirmed by the club owners on 2026-10-26, overriding RF-12 of the requirements PDF). Each concept is paid in full; there is no credit. A paid/unpaid state per concept is enough. |
| Advance payment | Paying months ahead is only a club custom (allowed up to the month before a price rise), not a system rule. |
| Member account states | The working states are up to date (no debt), debtor, and deregistered. Track unpaid concepts and periods so balances remain accurate even when the member pays components in a flexible order. |

### Processing flow

1. Search by DNI. If no member exists, validate the required registration data and create one; do not create a duplicate record for an existing member.
2. Identify whether the member is new, up to date, in debt, or deregistered. For an existing member, show unpaid periods and concepts before collecting money. More than three months without payment means deregistration and a full re-enrollment as a first-time member; preserve the prior history.
3. For each month, charge the social fee once and one activity fee per enrolled discipline. These are separate payable concepts: the social fee may be paid with either activity or later, and paying one concept does not settle the others.
4. Determine the payment date for each activity separately and apply that activity's surcharge tier. Keep enrollment, social fee, activity fees, surcharges, and carnet replacement as separate line items.
5. Record the payment method (cash, debit, or QR for member payments; transfer is mainly used for rentals in the current process) and issue a numbered receipt. Recalculate the member's outstanding balance and status from paid and unpaid concepts/periods. Do not physically delete a payment; an annulment requires a reason and is restricted to the Head of Secretariat by the approved requirement.

Examples for two disciplines:

- Existing member, both activities paid days 1–10: `$20,000` social + `$20,000` per activity = **`$60,000`**.
- New member, both activities paid days 1–10: the same `$60,000` + `$20,000` enrollment = **`$80,000`**.
- One activity paid on time and the other on day 13: **`$63,000`** (one `$3,000` surcharge).
- Both activities paid on day 13: **`$66,000`** (two `$3,000` surcharges).
- Both activities paid days 16–20: **`$70,000`**; both paid from day 21 onward (including day 31): **`$74,000`**.
- New member after the 15th, one discipline, paid days 1–10: `$20,000` enrollment + `$20,000` social + `$10,000` activity = **`$50,000`**.
- New member after the 15th, two disciplines: `$20,000` + `$20,000` + `$10,000` + `$10,000` = **`$60,000`**.
- Existing member adds a second discipline mid-month: **`$20,000`** for the new activity only.

The club currently accepts flexible payment arrangements and expects details to be refined as development progresses. Keep social fee, activity fees, enrollment, carnet replacement, and surcharges as distinct concepts. Do not assume that paying one component settles another.

These rules come from project-owner answers and are not yet reflected in the approved requirements PDFs, which still hold older amounts. Ask the project owners to confirm them and update the approved source.

## Next project work

Frontend routing, route protection, payments (the `/cobros` section) and the pricing configuration (the `/precios` section) are implemented. Check the approved requirements before extending them. Role-based authorization is distinct from merely requiring a signed-in session.

Tariffs, late-surcharge tiers, the new-member proration (cutoff day and percentage), discounts, promotions, and price increases must not be hardcoded. Each tariff has an effective date, so past and overdue periods keep the price in force at the time.

Pricing backend: `/api/pricing` (read: secretary and head secretary; writes: head secretary only), stored in `backend/data/pricing-config.json` (or `PRICING_CONFIG_FILE`; a missing file means the default prices). Tariffs of past months cannot be edited or deleted; a price rise is a new tariff with a later `effectiveFrom`. Discounts and promotions are not configurable yet.

Payments are stored append-only in `backend/data/payments.json` (or `PAYMENTS_FILE`); a payment snapshots its charge lines, and an annulment is a recorded reason, actor and date on the payment, never a deletion.
Receipt numbers are correlative integers allocated in the same write as the payment, never reused (also not after an annulment). The service is wired in `server.ts` and served under `/api/payments` (secretary and head secretary; only the head secretary annuls). The signed-in user is always the actor; amounts and `registration.enrollmentDate` in a body are ignored (a first-time registration is charged on the day it is made):
- `GET /members/:memberId/account` owed concepts and standing; `GET /members/:memberId` history; `GET /receipts/:receiptNumber` one receipt.
- `POST /preview` `{ memberId, concepts, registration? }` prices without writing; `POST /` adds `method` and a client-generated `requestId` (8–100 characters, reused on every retry of the same cobro) and returns 201 with the stored payment; repeating a `requestId` for the same member and concepts returns the existing payment instead of charging again, and reusing it for a different payment gives 409; `POST /:id/annul` `{ reason }` (head secretary).
- Find a member by DNI with `GET /api/members?search=<dni>`; payments has no search of its own.

Moving the remaining JSON modules to PostgreSQL remains a separate decision; do not use real club/member records or credentials for demonstrations.

## Member payment history

Added in commit `c9079ea` (`feat(members): show payment history under the member record`).

- The member record shows a read-only "Historial de pagos" section below the member sheet, only for users with `payments:read`.
- Columns: receipt number, date, detail lines, total, method, state (`Vigente` or `Anulado`) and a PDF receipt link. Newest payment first; the receipt number breaks same-day ties.
- Annulled payments stay listed with their reason (RNF-08), and an inactive member keeps its history (RF-05, RF-06).
- It reuses the payments feature: `fetchHistory` (`GET /api/payments/members/:memberId`), `ReceiptPdfLink`, `lineLabel`, `methodLabel` and `describeReadError`. A failed read shows one short line and never blocks the record.
- Code: `frontend/src/features/members/components/MemberPaymentHistory.tsx` and `frontend/src/features/members/hooks/useMemberPaymentHistory.ts`. Tests: `MemberDetailScreen.payments.test.tsx` in the same components folder.

## Project-owner answers of 2026-11-25

Answers to the requirements gap review. They are owner clarifications, not yet reflected in the approved PDFs; confirm them there when the PDFs are next revised. Nothing below is implemented unless it says so.

### Decided: to build

| Topic | Owner answer |
| --- | --- |
| RF-09 trial class | Add a "clase de prueba" charge. All of its money goes to the teacher. Design agreed 2026-11-26: |
| | **Not a member.** A trial class never creates a member record. It is its own record: DNI, first name, last name, discipline, date, amount, teacher, receipt number and the user who charged it. |
| | **Per-discipline settings.** The discipline form gets two fields, edited by the head secretary together with the teacher in charge: the trial class price (around `$10,000` today; the owner said "10") and how many trial classes a person may take in that discipline (2 today, editable per discipline). |
| | **Charging.** In Cobros, "Clase de prueba": enter the DNI, choose the discipline; the system counts that DNI's trial classes in that discipline and refuses one over the limit; the price comes from the discipline; a numbered receipt is issued. No surcharge and no social fee. |
| | **History.** A "Clases de prueba" list searchable by DNI and discipline. When the same DNI later becomes a member, the member record shows the trial classes taken. |
| | **Settlement.** Trial classes appear on their own line in the teacher settlement, 100% to the teacher. |
| | **Out of scope.** Whether the person is fit (apto) is the teacher's decision and is not recorded. |
| RF-26 automatic status | Add a scheduled process that marks members as debtor (moroso) when they owe, so the status does not depend on a screen reading it. |
| RF-21 due-soon notice | Add a section to send a WhatsApp message to a member whose fee is about to fall due ("próximo vencimiento"). Mass WhatsApp sending is left for the club to decide. |
| RF-16 rentals | Now in scope (overrides "Opcional" and the earlier "out of phase"). Record rental charges per tenant and month, in a section for charging tenants. |
| Rental transfers | In Cobros, add a form to record money received by bank transfer for rentals. |
| RNF-09 consent | Record consent when a member is registered, not only at face enrollment. Two forms: a virtual consent accepted in the system, and the paper consent the club already uses. Needs a database migration. Draft text: [`member-consent-draft.md`](member-consent-draft.md). The club's own paper form is [`club-member-agreement.md`](club-member-agreement.md): it holds club rules and a liability waiver but not the Ley 25.326 information, so the data clause from the draft is added to it. |
| RF-28 Excel import | Required, as a read-only historical lookup, for the club's own use. |
| RNF-04 storage | Migrate every module from JSON to PostgreSQL. |
| Padrón | Build a padrón of former and active students (alumnos y exalumnos), and a padrón of members with more than 6 months of activity. Both can be viewed on screen and downloaded as PDF. Fields: at least DNI, first name, last name and discipline, plus the usual data of a padrón (exact list not defined). "More than 6 months" means either 6 months active owing nothing and with nothing pending, or attending the club for more than 6 months. |
| Cash count history | The cash count (cierre de caja) history does not show the latest close and its time; it must. |
| Member payment history | Required. Done: see [Member payment history](#member-payment-history) (`c9079ea`). |

### Decided: rules

| Topic | Owner answer |
| --- | --- |
| RF-25 roles | Keep the current roles. Tesorería is not linked to the system for now; the head secretary does most of the administration. |
| RF-12 partial payments | Not accepted; confirmed again. Do not build. |
| Late surcharges | Every surcharge goes to the club, never to the teacher. Check the teacher settlement against this. |
| RF-19 "al día" | Per discipline: members who are active, have their fees paid, and owe nothing. The list comes with the amount collected, for the teachers' settlement. |
| "Vence" | The fee fell due (the due date passed without payment). |
| Old debt on re-registration | Decided 2026-11-26. Deregistration does not cancel the fees already owed. The debt is frozen at deregistration: the unpaid months up to that date stay on the account, and no new monthly fees accrue while the member is deregistered. Owed months are priced at the tariff in force on the payment date; surcharges follow the existing rule (by payment date, never accumulated). To re-register, the member must **first pay the old debt**, then pay as a first-time member (enrollment included). |
| Carnet at reception | The club agreement requires showing the member carnet at reception. That check stays manual at reception; the system does not ask for the carnet. |
| RF-13 payment method | The club has a Mercado Pago Point for QR. Transfers cannot be matched automatically because they arrive in a Banco Macro account. |

### Backup (RNF-03)

| Parameter | Owner answer |
| --- | --- |
| Destination | The same disk for now. Suggest to the club board (comisión) buying an inexpensive disk used only for backups. |
| Retention | Keep the current rule: the newest copy of each of the last 30 days that have copies, plus always the 5 most recent. |
| Who copies and restores | Only the head secretary, when she decides. The automatic daily copy stays. |
| Encryption | Not for now. |
| Schedule | The copy runs only while the backend runs on the secretary's PC; if the PC is off, no copy is made that day. |

### Still open

- Padrón: the full field list, and whether the student padrón and the members padrón are separate lists.
- Mass WhatsApp sending: for the club to decide.
- Reported issue to reproduce: creating a teacher account for a discipline such as basketball shows it already linked to that discipline. By design, a teacher's disciplines are the ones ticked under "Disciplinas que dicta" in the user form, or the teachers chosen in the discipline form; the empty user form preselects none. Reproduce before treating it as a bug.

## Engram portability and safety

`.engram/config.json` names this project `club-socios`. The shareable source is this reviewed handoff, not a native Engram export. Each contributor can manually save this file into their own local Engram database by following [the PowerShell instructions](../.engram/README.md); cloning does not synchronize local Engram memories. Do not import parent-project history or commit native exports containing local account or filesystem metadata. Importing this handoff changes a contributor's local Engram database, not the Git repository.

## After pulling the role change

A local `backend/data/users.json` created before the role change stores `demo@club.test` as `member`, which now maps to `secretary` and cannot open Usuarios. Delete that local file (it is gitignored demo data) so the backend reseeds it from `backend/src/database/demo-users.json`, where `demo@club.test` is `head_secretary` and `secretary@club.test` and `teacher@club.test` exist with the same demo password.

## Shared JSON store

`backend/src/database/json-store.ts` provides `createJsonStore<T>(filePath, defaultValue)`, returning `read()` and `update(fn)`. A missing file yields the default value, writes are atomic (temp file + rename) and serialized per file, and invalid JSON on disk throws instead of being overwritten.

- Each module owns its own file (for example `members.json`, `users.json`); do not share one file between modules.
- It is demo-only: not for production, real data, or multi-process use.
- Domain code depends on a repository interface; only the JSON repository implementation may import this helper.
- Run its tests with `pnpm --filter @club-socios/backend test`.
