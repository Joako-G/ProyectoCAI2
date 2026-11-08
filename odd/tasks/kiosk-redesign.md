# Client screen and Ingreso redesign (hands-free entrance)

## Objective
The member in front of the door sees a camera with a framing guide and, right after being recognized, their full name and the state of their fee, on a screen designed exactly like the mockup. Recognition is automatic: the secretary presses nothing. The secretary's Ingreso screen follows the mockup's "Ventanilla" design and shows the detail of each entrance as it happens.

## Problem and why
- The public screen today is a flat color with one line of text. It has no camera, no crest, no animation and no member panel, so it feels static and looks nothing like the approved mockup.
- Recognition is started by a button on the secretary's screen, so the secretary has to keep pressing it.
- The member cannot see where to place their face, because the camera is on the secretary's screen.
- The fonts load from Google Fonts, so offline the screens look different. RNF-01 asks for working without internet.

## Reference design
- Folder: `C:\Users\USUARIO\Downloads\Gestión Club - Demo interactiva`. It stays outside the repository. Only the crest, `assets/logo-cai.png`, is copied into the frontend.
- Client screen: `KioscoFacial.dc.html`.
- Secretary screen: `GestionClub.dc.html`, the "Ventanilla" view.
- The fingerprint variants are out of scope, because the club has no reader.

## Scope
- In:
  - The client screen with the live camera, the framing guide and the five states of the mockup.
  - Continuous recognition without any button.
  - The secretary's Ingreso redesigned like Ventanilla.
  - Self-hosted fonts.
- Out:
  - Fingerprint.
  - Anti-spoofing.
  - Payments or WhatsApp from these screens.
  - An attendance model.
  - Photos of members.
  - HTTPS.

## Decisions
- User, 2026-11-08:
  - The system (backend, frontend and database) runs on the front-desk PC, where the camera is. The head secretary's PC reaches it over the club network and does not need a camera. The camera works on `localhost`, so HTTPS is not needed now.
  - There are only two computers. The front-desk PC stays in the front secretary's own account, so there is no doorkeeper role. The client screen is a full-screen window of that session on a second monitor.
  - The client screen shows the full name.
  - A member who owes sees: "Hola, {full name}. Tenés cuotas pendientes desde {month year}. Pasá por secretaría." There are never amounts.
  - The design is reproduced identically from the mockup.
  - Recognition is automatic, with no button.
- Proposed by the assistant, provisional until the club confirms:
  - There is a single event stream with the staff-level detail. The client screen renders only a subset and never shows DNI, amounts or the reason for a refusal.
  - Initials in a circle replace "FOTO SOCIO", because photos are not stored.
  - The mockup's invented numbers are dropped: the match percentage, weekly attendance, class schedules, amounts, the WhatsApp notice and QR payment.
  - The same member is not announced again for about 30 seconds while they stay in front of the camera.
  - The result stays on screen for about 7 seconds.

### Client screen states

| Case | Panel | Text |
| --- | --- | --- |
| Up to date | Green | "Pasá, {full name}. Tu cuota está paga hasta {month year}. Vence el {dd/mm/yyyy}" |
| Owes 1 to 3 months | Amber | "Hola, {full name}. Tenés cuotas pendientes desde {month year}. Pasá por secretaría." |
| Deregistered | Red | The same text, asking to go to the secretary's desk |
| Inactive | Gray | "Hola, {full name}. Tu ficha figura inactiva. Pasá por secretaría" |
| Not recognized | Dark | "No pudimos reconocerte. Mirá de frente. Si sigue sin funcionar, pedí ayuda en secretaría". No member data. |

- Idle state: crest and "Bienvenido al club".
- Identifying state: "Quedate quieto un segundo…" with the progress bar.
- The framing hints ("Acercate", "Centrá la cara", "Falta luz") reuse the existing capture guide.

## Constraints
- No amounts, DNI or refusal reason on the client screen.
- Nothing about a member appears on screen unless the face matched.
- Offline: no CDN for fonts or images.
- Animations are disabled under `prefers-reduced-motion`.
- The camera keeps running all day, so the loop must stay cheap on this low-RAM PC.
- Conventions: `docs/AI-CODING-GUIDE.md`. UI copy in Spanish, identifiers and comments in English.
- Synthetic data only. Use the team's own faces with their permission.

## TDD
Mode: ON. Source: explicit user choice recorded in `odd/tasks/members-abm.md`. Runner: Vitest through `pnpm --filter <package> test`.

## Delivery
Work on `manu` (user preference), one work-unit commit per task. Each commit stays small enough for one native review. Push and PR remain the user's decision.

## Tasks
- [x] T1 — Design foundation. Self-hosted fonts, the crest, the mockup's colors, typography and animations as shared styles.
- [x] T2 — Richer entrance events: full name, case, month of the debt or of the due date, and the member's disciplines. Backend and parser.
- [x] T3 — Client screen like "Kiosco facial": full viewport and centered, live camera, an oval guide, a frame that follows the detected face, the progress bar, the live clock and the five states.
- [x] T4 — Hands-free loop on the client screen, with the 30-second anti-repeat and a visible message when the session expires.
- [ ] T5 — Secretary's Ingreso like "Ventanilla": the result banner, the member card, "Cobrar cuota" and "Ver ficha completa", "Accesos de hoy" with chips, and "Hoy en el club" counters. The "Cámara" button goes away and the DNI field stays as a fallback.
- [ ] T6 — Side-by-side comparison with the mockup and tuning.

## Checks
- Backend and frontend tests and typechecks, with Docker running.
- Browser check with the team's faces.
- T6: serve the mockup folder on another port and compare screenshots of both next to each other, state by state.

## Open items
- Owners: confirm the public texts, and that showing the full name and a debt on a public screen is acceptable (Ley 25.326).
- Owners: what "vence" means (pending question 8), the consent text (pending question 14), and who may read the entry log.
- PostgreSQL still has no backup. It is tracked in `odd/tasks/face-recognition-demo.md`.

## Progress
- 2026-11-08: the plan is agreed with the user. The mockup was read. The existing screens were reviewed: `EntranceDisplay`, `AccessPage` and the fonts in `frontend/index.html`.

- 2026-11-08, T1 done (route: delegated writer, trigger: 2+ non-trivial files). RED: `offline-fonts.test.ts` failed 2 of 2 (index.html still named fonts.googleapis.com; main.tsx lacked the `@fontsource/ibm-plex-sans/` imports). GREEN: 2 of 2 pass; frontend suite 63 files, 635 tests pass; typecheck clean. Fonts: @fontsource ibm-plex-sans, ibm-plex-mono, libre-baskerville 5.3.0, latin and latin-ext. Crest: `frontend/public/brand/logo-cai.png`, 188541 bytes. Vite dev server answered 200 for the font CSS, a woff2 file and the crest. Reduced motion is scoped to a `.kiosk` wrapper so existing screens are untouched.
- 2026-11-08, T2 done (route: delegated writer, same writer as T1). RED: backend `tests/access` 16 failed (service registration with the new member shape, 3 discipline-port cases, 11 greeting/recorder cases) plus `member-disciplines.test.ts` failing with "Cannot find module"; frontend `greeting-format.test.ts` 4 of 11 failed (kind/member/detail parsing). GREEN: backend 69 files, 1122 tests, typecheck clean; frontend 63 files, 640 tests, typecheck clean. The event stays additive: `tone` and `firstName` are unchanged, and the frontend `kind` and `method` are optional so a message without them still drives the current display. A face that matched an inactive member is reported as `not_recognized` with no member data, as the door already treats it.

- 2026-11-08: Gentle-AI review of T1+T2 (`d9a6570`..`e464602`, lineage `review-f70fbdbc92a87507`, 22 files, 670 lines, medium risk, consent granted): approved and acknowledged, with no findings listed.

- 2026-11-08, T3 done (route: delegated writer, trigger: 2+ non-trivial files across backend and frontend). RED: backend `service.summary is not a function` and `GET /api/faces/summary` answered the member status instead of the count (2 failed); frontend utils `fit-scale`, `pane-geometry`, `kiosk-texts` failed with "Failed to resolve import", `greeting-format` 1 failed (a message without kind and method was still accepted), `useCaptureGuide` box test and `getFaceSummary is not a function`, `KioskScreen` failed to resolve, `EntranceDisplay` 16 failed. GREEN: backend 69 files, 1128 tests with Docker, typecheck clean; frontend 67 files, 688 tests, typecheck clean.
  - Stage: rendered at 1180x700 and scaled with `fitScale(w, h) = min(w/1180, h/700)` by a resize listener, centered on both axes on #111820 inside a `kiosk` wrapper.
  - Frame: `useCaptureGuide` now returns the face `box`; `frameForFace` maps it to the 710x700 pane (cover crop and mirror) and the frame moves with a 120 ms CSS transition, falling back to the design position. The oval dims what is outside it with a box-shadow.
  - Backend: `GET /api/faces/summary` returns `{ enrolled }`, route matrix row added, read-only for the audit coverage. The client screen omits the number if it cannot be read.
  - Frontend event type: `kind` and `method` are now required; a stream message without them is ignored. `greetingText` was removed (all copy lives in `kiosk-texts.ts`).
  - Decision gaps: the member avatar is a 78 px circle (the photo box was 78x96); the idle fallback line reads "¿No funciona? Pedí ayuda en secretaría: te buscan por DNI."; a member kind with no member data is shown as "Probá otra vez". The hands-free loop, the identifying state, session expiry and the 503 state are wired in T4 (the screen already renders them). Visual check against the mockup is T6; the real camera was not exercised here.

- 2026-11-08, T4 done (route: delegated writer, same writer as T3). RED: `repeat-guard` and `greeting-from-check` failed with "Failed to resolve import"; `EntranceDisplay.recognition.test.tsx` failed 17 tests (for example `expected [] to have a length of 1 but got +0` for the recognize call, and "Unable to find role heading and name Quedate quieto un segundo…"). GREEN: frontend 70 files, 718 tests (the recognition file passed three runs in a row), typecheck clean. Backend unchanged since T3.
  - Loop: `useKioskRecognition` reuses `useCameraEntrance` (and so the capture guide, its 250 ms sampling, the 3-look stability window and the 4 s pause). `RecognizeOutcome` gained `skipped` and `unauthorized`; the secretary's camera mode is untouched.
  - Anti-repeat: `createRepeatGuard` runs before the server call. `SAME_PERSON_DISTANCE = 0.4` (strictly below), `SAME_PERSON_WINDOW_MS = 30000`. Only a recognized member is remembered, so a stranger who tries again is asked about again; a different person is recognized at once.
  - Results: the stream is the single source. The HTTP answer is a fallback: shown at once when the stream is down, and after `DEFAULT_STREAM_GRACE_MS = 2000` when the stream is up but the event does not arrive. A new attempt clears the result of the previous person.
  - Session: when the stream closes, `GET /auth/me` decides (an EventSource cannot see the status); a 401 from recognize does the same. The screen then shows "Sesión vencida: iniciá sesión en esta PC", releases the camera and stops reconnecting. The link opens `/pantalla-ingreso`, which reloads the app: without a session it asks to sign in and returns to the screen, which reconnects. 503 shows the gray "Reconocimiento no disponible: pedí ayuda en secretaría" and stops asking; results sent by the secretary still show.
  - Decision gaps: the stream key and the HTTP fallback rebuild the first name from the first word of the name and leave the disciplines empty. The "unauthorized" path was tested with a fake 401; the real expiry of the server session was not exercised. The real camera was not exercised.

- 2026-11-08: Gentle-AI reviews of T3 and T4, in two parts because the whole range (2,576 lines) exceeded the review size, consent granted each time; both approved and acknowledged.
  - Part 1 (`08070f9`..`117297d`, lineage `review-ee17b884c0711ff4`, 35 files, 1,870 lines, medium risk), reviewed in a temporary detached worktree. One suggestion, later work: `R3-frame-transition-vacuous` (the frame-follows-face test does not prove the CSS transition).
  - Part 2 (`117297d`..`67acb5b`, lineage `review-34be278f434a2878`, 14 files, 744 lines, medium risk): no findings listed.
- 2026-11-08: browser check at `/pantalla-ingreso` as `secretary@club.test`, with the Vite and backend dev servers (backend with `DATABASE_URL`), against the mockup served from its folder on another port. The Browser pane blocks the camera, so the live video, the face-following frame, the guidance hints and the recognition loop were NOT seen; they are covered by tests with fakes only.
  - Idle: crest, `Bienvenido al club`, dashed oval, live badge and clock, same layout as the mockup. The camera-denied line shows on the left pane.
  - Green (`99000005`): green panel, check icon, `Pasá, Hugo`, card with initials, `AL DÍA`, `Próximo vencimiento 10/01/2027`.
  - Red (`99000003`): red panel, `Rocío, pasá por secretaría`, `Tenés cuotas pendientes desde enero 2026. Pasá por secretaría.` and no amounts.
  - Not found (`99999999`): dark panel, `Probá otra vez`, no member data.
  - Not seen in the browser: the amber (debtor) and gray (inactive) cases, because no synthetic member owes only 1 to 3 months. They are covered by tests.

- 2026-11-08, T5 part 1 (route: delegated writer, same writer as T3/T4). `GET /api/access/entries` now also returns `distinctMembers` (different members with a green or yellow check) and `counts: { entered, warned, refused }` (entered is green plus yellow). `count` is unchanged. This answers the earlier review finding that the day's count counted checks, not people: the existing list now says "N socios ingresaron" from `distinctMembers`. RED: `access.entries.test.ts` 3 failed (`expected undefined to deeply equal { entered: 3, warned: 1, refused: 1 }`, `expected undefined to be 1`, and the empty-day match); frontend `EntriesToday` 1 failed (`Unable to find an element with the text: 1 socio ingresó`). GREEN: backend 69 files, 1131 tests with Docker, typecheck clean; frontend access suite 148 tests, typecheck clean.

## Next step
T5. T6 remains for the side-by-side comparison with the camera on.
