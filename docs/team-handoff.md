# Team handoff: club membership system

This is the shared, version-controlled project context for collaborators and coding assistants. The repository now contains working authentication, user administration, member administration, and discipline features; reserved folders do not imply that payment or membership behavior is already implemented.

## Quick path

1. Open this repository as the working directory. Install with `pnpm install`; verify with the relevant package tests, `pnpm build`, and `pnpm typecheck`.
2. Follow [`AGENTS.md`](../AGENTS.md): read relevant current sections of both requirements PDFs under `docs/` first, then [`AI-CODING-GUIDE.md`](AI-CODING-GUIDE.md), then inspect the owning code and tests.
3. Read this handoff as the portable source of team context. For a manual, per-machine Engram save, follow [the PowerShell instructions](../.engram/README.md). Markdown is **not** imported into Engram automatically; do not import parent-project history.

## Agreed boundaries

| Area | Current state and next boundary |
| --- | --- |
| Frontend | React + TypeScript + Vite. Existing feature areas include `auth`, `users`, `members`, and `disciplines`; `payments` and `memberships` are reserved for future work. Put feature code under `frontend/src/features/<feature>/`; use shared top-level folders only for genuinely cross-feature code. |
| Backend | Express + TypeScript. Existing modules include `auth`, `users`, `members`, and `disciplines`; `payments` and `memberships` are reserved for future work. New domain behavior belongs under `backend/src/modules/<feature>/`; follow the actual route/service/repository pattern without adding controller layers automatically. |
| Authentication and routing | Server-side sessions are implemented. The current protection scope and missing frontend route navigation are still project work; inspect current code before changing either. Authentication (signed-in status) and authorization (role permissions) are separate concerns. |
| Persistence and tests | Demo data uses JSON persistence and the session store is in memory; neither is production-grade storage. Frontend and backend have package test scripts; root provides build and typecheck, not a root test script. Use the exact commands in the coding guide. |
| Delivery | Keep work reviewable and agree on API contracts before wiring a new frontend flow to the backend. |

## Enrollment and payment rules agreed so far

These are current project-owner clarifications for the demo flow. The spreadsheet screenshots contain historical amounts; do not treat their `$15,000` values as current tariffs. The requirements PDFs still contain older amounts and open questions, so this handoff records newer clarifications without claiming every edge case is finalized. Revisit the relevant requirements and update their approved source when the club finalizes remaining policies.

| Concept | Current working rule |
| --- | --- |
| New member | Register by unique DNI. Charge a one-time enrollment fee of `$20,000`; adding another activity later does not charge enrollment again. |
| Monthly social fee | `$20,000` once per member and month. It may be paid with either activity or separately; do not force it to be attached to the first activity or a fixed payment order. |
| Activity fee | `$20,000` for each discipline in the current example. A second discipline adds its activity fee, not another social fee. |
| New-member proration | A new member enrolling after the 15th pays half of the first activity's monthly quota (`$20,000` instead of `$40,000`), in addition to enrollment. Handling additional activities in this proration case remains unspecified. |
| Late surcharge | Apply per activity being paid, based on its payment date: days 1–10 `$0`; days 11–15 `+$3,000`; days 16–20 `+$5,000`; days 21–30 `+$7,000`. Add the applicable surcharge to each late activity; do not apply just one surcharge when multiple activities are late. Day 31 is undefined. |
| Carnet | The first carnet is free. A replacement costs `$3,000`. |
| Member account states | The working states are up to date (no debt), debtor, and deregistered. Track unpaid concepts and periods so balances remain accurate even when the member pays components in a flexible order. |

### Processing flow

1. Search by DNI. If no member exists, validate the required registration data and create one; do not create a duplicate record for an existing member.
2. Identify whether the member is new, up to date, in debt, or deregistered. For an existing member, show unpaid periods and concepts before collecting money. The requirements describe more than three months without payment as a re-enrollment case; preserve the prior history and confirm debt valuation/collection limits before encoding them.
3. For each month, charge the social fee once and one activity fee per enrolled discipline. These are separate payable concepts: the social fee may be paid with either activity or later, and paying one concept does not settle the others.
4. Determine the payment date for each activity separately and apply that activity's surcharge tier. Keep enrollment, social fee, activity fees, surcharges, and carnet replacement as separate line items.
5. Record the payment method (cash, debit, or QR for member payments; transfer is mainly used for rentals in the current process) and issue a numbered receipt. Recalculate the member's outstanding balance and status from paid and unpaid concepts/periods. Do not physically delete a payment; an annulment requires a reason and is restricted to the Head of Secretariat by the approved requirement.

Examples for two disciplines:

- Existing member, both activities paid days 1–10: `$20,000` social + `$20,000` per activity = **`$60,000`**.
- New member, both activities paid days 1–10: the same `$60,000` + `$20,000` enrollment = **`$80,000`**.
- One activity paid on time and the other on day 13: **`$63,000`** (one `$3,000` surcharge).
- Both activities paid on day 13: **`$66,000`** (two `$3,000` surcharges).
- Both activities paid days 16–20: **`$70,000`**; both paid days 21–30: **`$74,000`**.

The club currently accepts flexible payment arrangements and expects details to be refined as development progresses. Keep social fee, activity fees, enrollment, carnet replacement, and surcharges as distinct concepts. Do not assume that paying one component settles another.

Still to confirm before encoding affected cases: handling on day 31; proration when adding an activity mid-month; the tariff basis and maximum count for overdue months; and whether arbitrary partial payments within a single concept are accepted. The report's note about up to two months paid in advance is conditional on no fee increase in the next month and should be confirmed before being treated as a hard system rule.

## Next project work

The user identified frontend routing and authentication-based route protection as unfinished. Complete those before expanding into payments. Then implement payments as a vertical flow using the rules above, checking the approved requirements first. Role-based authorization is distinct from merely requiring a signed-in session. PostgreSQL, migrations, Docker, and biometric access remain separate decisions; do not use real club/member records or credentials for demonstrations.

## Engram portability and safety

`.engram/config.json` names this project `club-socios`. The shareable source is this reviewed handoff, not a native Engram export. Each contributor can manually save this file into their own local Engram database by following [the PowerShell instructions](../.engram/README.md); cloning does not synchronize local Engram memories. Do not import parent-project history or commit native exports containing local account or filesystem metadata. Importing this handoff changes a contributor's local Engram database, not the Git repository.

## Shared JSON store

`backend/src/database/json-store.ts` provides `createJsonStore<T>(filePath, defaultValue)`, returning `read()` and `update(fn)`. A missing file yields the default value, writes are atomic (temp file + rename) and serialized per file, and invalid JSON on disk throws instead of being overwritten.

- Each module owns its own file (for example `members.json`, `users.json`); do not share one file between modules.
- It is demo-only: not for production, real data, or multi-process use.
- Domain code depends on a repository interface; only the JSON repository implementation may import this helper.
- Run its tests with `pnpm --filter @club-socios/backend test`.
