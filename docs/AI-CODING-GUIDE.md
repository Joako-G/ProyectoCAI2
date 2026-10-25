# AI coding guide for club-socios

This guide aligns contributors and coding assistants working on **club-socios**. It describes this repository's conventions; it does not import architecture or business rules from other projects.

This is the placement and naming contract for new code. It does not authorize moving existing code, changing business rules, or importing conventions from another repository.

## Quick path

1. Read the relevant approved requirements in both project PDFs under `docs/` before planning or changing behavior. Identify the applicable `RF` and `RNF` IDs when present.
2. Read this guide for placement, naming, and implementation conventions. Conventions never override a requirement.
3. Inspect the relevant implementation and tests before extending a feature. Preserve existing behavior unless an approved requirement or explicit change replaces it.
4. Verify the changed behavior with the relevant package's tests and typecheck before delivery.

## Scope and language

- Write code identifiers, filenames, comments, test descriptions, and technical documentation in English.
- Write user-facing interface text in Spanish, matching the existing members and users screens. Keep API values and identifiers in English unless a contract explicitly says otherwise.
- Use clear, literal instructions for AI assistants. English is a consistency choice for this repository, not a claim that an AI cannot follow Spanish instructions.
- Do not copy rules, dependencies, or business assumptions from another repository without an explicit decision for club-socios.

## Sources of truth

| Source | Use it for |
| --- | --- |
| `docs/Modelo_Sistema_ClubOCEA.drawio.pdf` | Approved functional requirements (`RF`, page 5) and nonfunctional requirements (`RNF`, page 6) for the proposed system. Read the relevant current sections first. |
| `docs/Informe_Relevamiento_ClubOCEA.pdf` | Approved project research and current-process context. Read relevant sections before implementation; distinguish observed processes and open questions from final software rules. |
| This guide | Where and how to implement approved behavior. It cannot change business scope or override either PDF. |
| Current source code and tests | Existing behavior, module boundaries, and executable contracts; not authority to disregard a changed requirement. |
| `odd/tasks/` | Feature decisions, verification evidence, and historical progress. Confirm that claims still match current approved requirements and code. |
| `README.md` and `docs/team-handoff.md` | Setup and onboarding context. Both contain scaffold-era descriptions that must be checked against current code and the PDFs. |

The project owners have identified the current PDFs as approved references. Re-read the checked-in versions for every relevant task; do not rely on an AI memory, an old excerpt, or an older copy. If a PDF changes, confirm which revision is approved before using the new text as authority. The model PDF includes priorities such as desirable and optional; the research report includes questions and proposals. Approval of a document does not automatically select every optional feature or answer every open question.

When the PDFs disagree with each other, with the task request, or with existing code/tests, do not silently choose one. Report the exact document section or requirement ID and ask the project owners to resolve the business decision before implementing it. Record the resolved decision with its requirement reference so both collaborators can use the same rule.

## Current project boundary

The repository is a pnpm workspace with a React/TypeScript/Vite frontend and an Express/TypeScript backend. The implemented demo covers login, user administration, and member administration. Login creates a server-side session (an httpOnly cookie backed by an in-memory store that is lost when the server restarts). Every backend route except `/auth/*` and `/health` requires a session and a role allowed by the capability map in `backend/src/modules/auth/permissions.ts` (401 without a session, 403 for a disallowed role); the frontend does not yet hide navigation by role. JSON files are demo storage, not production persistence. Do not present either as production security or durability.

## File placement: feature first

New feature-specific frontend code belongs under `frontend/src/features/<feature>/`. New feature-specific backend code belongs under `backend/src/modules/<feature>/`. Keep a feature's components, hooks, services, types, validation, and tests near that feature when applicable. For example, member UI code lives under `frontend/src/features/members/`, while member backend code lives under `backend/src/modules/members/`.

Use top-level frontend folders such as `components/`, `hooks/`, `services/`, `types/`, and `utils/`, or backend folders such as `shared/` and `utils/`, only for code genuinely shared across features. Do not create a top-level file merely because a matching folder exists, and do not create a new folder without a clear responsibility.

This is a rule for new code, not a claim that all existing code already follows it. User administration lives in `frontend/src/features/users/` and `backend/src/modules/users/` (repository, service, routes, validation, and password hashing). Login and session live in `frontend/src/features/auth/` (`LoginScreen`, `useLogin`, `useSession`, `SessionPanel`, `auth-api`) and `backend/src/modules/auth/` (`auth.routes.ts` mounts `POST /auth/login`, `GET /auth/me` and `POST /auth/logout`; `auth.session.ts` holds the in-memory session store and resolves the user from the cookie; `auth.service.ts` reads accounts through the users repository and `verifyPassword`). Authorization lives in `backend/src/middlewares/require-role.ts` (`requireCapability`, `requireCapabilityByMethod`); routes ask for a capability from `permissions.ts`, never for a role directly. Front-end requests to `/auth/*` must send `credentials: 'include'`.

For new auth code, use `frontend/src/features/auth/` and `backend/src/modules/auth/`. For user-administration code, use `frontend/src/features/users/` and `backend/src/modules/users/`. Keep auth (sign-in/session concerns) separate from users (account administration). Reuse the users repository and password helpers instead of duplicating account storage or hashing.

### App files are composition roots

For **all new code**, `frontend/src/App.tsx` may select and connect feature screens, providers, and application navigation; `backend/src/app.ts` may create the Express app, configure shared middleware, and mount module routers. They must not become the home for a feature's forms, list rendering, fetch operations, validation, business rules, or persistence. Put those responsibilities in the owning feature/module and import its screen or router into the app file. A small wiring change in an app file is expected; adding feature logic there is not.

## Frontend: React responsibilities

| Responsibility | Location inside `features/<feature>/` | Rule |
| --- | --- | --- |
| Feature UI | `components/` | React `.tsx` components render UI and receive data/actions through props where practical. Split at cohesive responsibilities, not an arbitrary line count. |
| Feature state/effects | `hooks/` | `use...` hooks own reusable stateful behavior, fetching coordination, cancellation, and derived state. |
| HTTP access | `services/` | Centralize endpoint calls and response/error handling; do not scatter request code through presentational components. Reuse the feature's existing service. |
| Client types | `types/` | Describe API and UI data shapes without redefining incompatible copies. |
| Pure transformations | `utils/` | Keep formatting and calculation functions independent of React and network state. |
| Input schemas/validation | `schemas/` or the feature's established `utils/` pattern | Use only when needed; client validation complements, never replaces, backend validation. |
| Feature test data | `test/` | Put reusable feature fixtures here; keep individual tests close to the code tested. |

Existing members examples: `MembersPage.tsx` composes UI and its list hook; `useMembersList.ts` owns list state and request cancellation; `members-api.ts` handles the HTTP boundary; `member-format.ts` contains pure formatting. Follow the same **responsibility split**, not necessarily identical file counts for every feature.

Application-wide layout components belong in `frontend/src/layouts/`. `App.tsx` should be an application composition/navigation boundary, not the default home for a feature's forms, fetch calls, validation, and list rendering. Root `components/`, `hooks/`, `services/`, `types/`, and `utils/` are for demonstrated cross-feature reuse. Empty `pages/`, `routes/`, or `store/` folders do not require a new feature to use them. Do not add React Router or a state/data library just to match a folder name.

Use React conventions: `.tsx` for components, props for component contracts, hooks for stateful reusable logic, and component composition for screens. Do not generate Angular modules, decorators, templates, dependency-injection scaffolding, or Angular-specific file suffixes for the React frontend. The existing `backend/src/modules/members/member.service.ts` is an Express backend domain service used by `member.routes.ts`; its filename does **not** make it an Angular service. Judge a file by its imports and responsibility, not a suffix shared by multiple frameworks.

## Backend: module responsibilities

| Responsibility | Location inside `modules/<feature>/` | Rule |
| --- | --- | --- |
| HTTP routes | `<entity>.routes.ts` | Define endpoints, read HTTP inputs, invoke the service, and map results/errors to responses. Keep business decisions out. |
| Business behavior | `<entity>.service.ts` | Enforce domain rules and coordinate repository operations. Accept dependencies rather than hiding storage inside route handlers. |
| Persistence contract | `<entity>.repository.ts` | Define the operations the service needs; avoid coupling business logic to JSON file operations. |
| Persistence adapter | `json-<entity>.repository.ts` | Implement the contract using existing JSON infrastructure when demo storage is appropriate. |
| Input validation | `<entity>.validation.ts` | Validate and normalize untrusted input before domain operations. |
| Domain types | `<entity>.types.ts` | Define canonical module data shapes. |

The members module is the reference implementation for these boundaries. `backend/src/app.ts` composes and mounts HTTP routes; `backend/src/server.ts` starts the process. Shared persistence primitives live in `backend/src/database/`; cross-module errors and other truly shared contracts live in `backend/src/shared/`. Existing active HTTP middleware is in `backend/src/middlewares/`; do not choose the separate placeholder `middleware/` directory for new middleware without resolving that duplication.

Do not force every small module to have every possible layer or create pass-through files with no responsibility. Keep the route/service/repository distinction when behavior crosses those boundaries. Never copy the members module's business rules into another domain.

Keep files directly in the owning module by default, as `modules/members/` does today. Add a subfolder such as `routes/` or `repositories/` **inside that module** only when several related files make the responsibility hard to navigate; do not create one subfolder per layer automatically or move feature files into global layer folders.

## File and symbol naming

| Kind | Convention | Existing example |
| --- | --- | --- |
| React component file and exported component | `PascalCase.tsx` / `PascalCase` | `MembersTable.tsx` / `MembersTable` |
| React hook file and function | `usePascalCase.ts` / `usePascalCase` | `useMembersList.ts` / `useMembersList` |
| Frontend service or pure utility file | lowercase kebab-case `.ts` | `members-api.ts`, `member-format.ts` |
| Frontend domain type file | lowercase domain name `.ts` | `member.ts` |
| Backend module file | lowercase entity + responsibility suffix | `member.service.ts`, `member.validation.ts` |
| Backend adapter file | adapter + entity + responsibility suffix | `json-member.repository.ts` |
| Test file | source basename + `.test.ts` or `.test.tsx` | `MembersTable.test.tsx`, `member.service.test.ts` |
| Variables/functions, types/interfaces, constants | `camelCase`, `PascalCase`, `UPPER_SNAKE_CASE` respectively | `useMembersList`, `MemberRepository`, `DNI_QUERY` |

Use singular names for one domain entity (`member.types.ts`) and plural names where the API or collection concept is plural (`members-api.ts`, `MembersTable.tsx`). Prefer the naming already used by the owning feature. Do not rename existing public exports or files merely to satisfy a naming preference; that is a separate compatibility change.

Implemented TypeScript files use two-space indentation, single quotes, and semicolons. Preserve this local style; do **not** copy Margarita's no-semicolon convention into this repository. Prefer descriptive names over framework-style suffixes that do not express a real responsibility.

## Creating a new feature: placement example

If a requested feature is `payments`, create only the files needed for its behavior. A possible shape is:

```text
frontend/src/features/payments/
  components/PaymentsPage.tsx
  components/PaymentsPage.test.tsx
  hooks/usePaymentsList.ts
  services/payments-api.ts
  types/payment.ts

backend/src/modules/payments/
  payment.routes.ts
  payment.service.ts
  payment.repository.ts
  payment.validation.ts
  payment.types.ts
backend/tests/payments/payment.api.test.ts
```

This tree illustrates **ownership and naming**, not a mandate to create all listed files or to implement payments without approved business rules. If the feature is backend-only or frontend-only, create only that side. If a file already exists for the responsibility, extend it instead of creating a duplicate.

## Verification and delivery

Use the package scripts that actually exist. There is no root `test` or `lint` script at present; do not report either as run.

```sh
pnpm --filter @club-socios/frontend test
pnpm --filter @club-socios/frontend typecheck
pnpm --filter @club-socios/backend test
pnpm --filter @club-socios/backend typecheck
pnpm build
```

Run the checks applicable to the changed package and integration boundary. The backend test script builds first, then runs its Node and Vitest tests. For documentation-only edits, check structure, links, and diff whitespace; do not invent a test result. Report failures or skipped checks honestly.

Before handing off a code change, confirm:

- [ ] Every new file has a named feature/module owner or documented cross-feature reason.
- [ ] Each file has one clear responsibility, and existing helpers/contracts were reused.
- [ ] React-specific code uses React patterns; backend business rules are not embedded in HTTP handlers.
- [ ] New behavior has relevant tests and does not silently change existing behavior.
- [ ] User-facing copy is Spanish; technical names and docs are English.
- [ ] The delivery states what changed, what was verified, and what remains uncertain.
