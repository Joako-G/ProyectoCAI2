# Club expenses (gastos)

Objective: let staff record and list the club's expenses. Branch: JoakoG. Runner: vitest (backend and frontend).

## IMPORTANT: assumptions to confirm with the club / project owners

No approved requirement defines expenses: the model PDF has no `RF` about them (RF-01..RF-28), and the research report only mentions "gastos" in the printed RESUMEN sheet (section 3.5 and the reports process). Everything below is a **minimum assumption**, marked `PROVISIONAL(E#)` in the code. Ask the owners before treating any of it as a business rule.

| ID | Assumption | Where | Question to ask |
| --- | --- | --- | --- |
| E1 | Fixed category list: services, maintenance, supplies, salaries, other | `expense.types.ts`, frontend `expense.ts` | Which categories does the Excel RESUMEN sheet use? |
| E2 | Fields: date, amount, category, description. No payment method, invoice/receipt number or supplier | `expense.types.ts` | Does the club need method (it affects the Arqueo), invoice number or supplier? |
| E3 | The date may be today or in the past, never in the future | `expense.service.ts` | Is a late entry allowed? Is there a cut-off? |
| E4 | `secretary` and `head_secretary` may both read and record expenses | `permissions.ts` | Who may record them? Does Tesorería (no role yet) need access? |
| E5 | Append-only: no edit, delete or annulment | `expense.repository.ts` | How is a mistaken entry corrected? Annulment by the head secretary, as in RF-15? |
| E6 | Expenses are NOT part of the revenue report or the Arqueo | `reports/` untouched | Should the monthly summary show income minus expenses (the old RESUMEN sheet)? |

## Specs

- S1: A signed-in `secretary` or `head_secretary` can record an expense with date, amount, category and description (E1-E4).
- S2: They can list the recorded expenses, newest first, optionally between `from` and `to` dates.
- S3: Every recorded expense is audited (RF-27) with the signed-in user as author; the body never sets the author.
- S4: Data is backed up with the other JSON files (RNF-03).

## Tasks

- T1 (S1-S3): backend module `backend/src/modules/expenses/`, capabilities, audit entity `expense`, route matrix. Route: inline. Done, tests green.
- T2 (S4): `expenses.json` in `backupSources`, `EXPENSES_FILE` in `paths.ts`. Route: inline. Done.
- T3 (S1-S2): frontend `frontend/src/features/expenses/`, section "Gastos" at `/gastos`. Route: inline. Done.

## Log

- L1 (user): "Hay que agregar gastos" / "agregar un formulario o seccion para anotar los gastos del club" / "asumi un minimo de campos y roles pero marcalo como importante para luego preguntar".
- Verified 2026-11-09: backend `pnpm test` 72 files / 1202 tests pass; frontend typecheck, 74 files / 749 tests and `pnpm build` pass.
- Note: the backend `test` script lists test folders by hand; `tests/expenses` was added to it.
- Not verified: manual run in the browser, and the Excel RESUMEN categories.
