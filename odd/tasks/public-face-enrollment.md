# Face enrollment on the public screen

Objective: when staff register a member's face, the member sees on the public screen (the kiosk in front of them) where to place their face, with the oval, the hints and the progress, while the secretary follows the same process on their own screen and guides the member. Branch: manu. Runner: vitest (backend and frontend). TDD: not configured; ordinary functional checks apply.

Requirements: RF-08 (Deseable: access control; face recognition is the phase-2 biometrics of the research report), RNF-09 (privacy: consent recorded at enrollment, no images stored or sent, only the mean descriptor), RNF-10 (validation). Existing rules kept from `odd/tasks/face-recognition-demo.md`: consent checkbox with time and staff member recorded; three consistent captures; only the mean 128-d descriptor reaches `PUT /api/faces/:memberId`; inactive members cannot be enrolled.

## Problem

Today "Registrar cara" (`faces/components/FaceEnrollment.tsx` in the member record) opens the camera in the secretary's own window, so the guidance is on the secretary's monitor and the member does not know where to look. User, 2026-11-09: "el socio mira dónde tiene que poner su cara, entonces eso debemos mejorarlo; está bien que la secre también vea dónde pone la cara porque así lo va guiando".

## Setup this relies on (documented in `odd/tasks/kiosk-redesign.md`)

- The camera is on the front-desk PC. The public screen (`/pantalla-ingreso`, `KioskScreen`) is a full-screen window of the front secretary's session on that PC's second monitor, and already runs the camera with an oval guide for recognition.
- The head secretary's PC reaches the system over the club network and has no camera.
- Secretary to display talk over the existing one-way SSE greeting bus (`access/greeting.bus.ts`, `GET /api/access/display-events`). There is no channel back from the display.

## Design

- The capture runs **on the public screen**, which owns the camera that faces the member. The secretary starts it and watches it; the member sees the guidance in front of them.
- Flow:
  1. In the member record, "Registrar cara" keeps the consent checkbox (required). With consent ticked, the secretary presses "Registrar en la pantalla pública". The backend opens an **enrollment session** for that member (one at a time; in memory; expires after about 2 minutes; records the staff member and consent time as today) and publishes an `enrollment` event on the display stream.
  2. The public screen switches to enrollment mode: it pauses recognition, shows "Registro de rostro" with the member's first name, the oval, the live hint from `useCaptureGuide` in large type, and "Captura 1 de 3 … 3 de 3". It reuses `CaptureGuide` / `useCaptureGuide` / the existing capture logic.
  3. The public screen reports progress (status, hint, captures done) and finally the mean descriptor to the backend through new routes scoped to that session id (capability `faces:manage`; the front secretary's session has it). The backend saves the face exactly as `PUT /api/faces/:memberId` does today and closes the session.
  4. The secretary's screen follows the session through a stream or short polling of the session state (pick the simplest that is reliable; the SSE bus is display-only today): it shows the same hint, the progress, success or failure, and a "Cancelar" button. On the front-desk PC it also shows a local read-only camera preview if a camera is available, so the secretary sees where the face is; on a PC without camera it shows the status only.
  5. On success, cancel, timeout or error, the public screen returns to recognition mode.
- Fallback: when no public screen is connected (the backend knows if the display stream has subscribers), the button is not offered and the current in-window enrollment ("Registrar en esta pantalla") stays available. The in-window path is kept in any case.
- Privacy: no image or video leaves the browser; the event payloads carry the member's first name only (no DNI, no number, no descriptor on the display stream). The descriptor goes only from the public screen to the backend, as today from the secretary screen.

## Specs

- S1: enrollment session API (open with consent, state, progress, complete with descriptor, cancel), one active session, expiry, `faces:manage`, validation, audit as the current face enrollment does, tests including expiry and a second open refused.
- S2: display stream event for start, cancel and end; display subscriber count exposed to the secretary screen (or a flag in the session open answer).
- S3: public screen enrollment mode (pauses recognition, guidance, progress, sends progress and descriptor, returns to recognition), tests.
- S4: secretary screen: start on the public screen, follow progress, cancel, optional local preview, fallback to in-window enrollment, tests.
- S5: browser check with the two windows on one PC (camera checked by the user; the automated browser has no real camera).

## Tasks

- [x] T1 (S1, S2): backend enrollment session and display events. Route: delegated (writer trigger: 2+ non-trivial files).
- [x] T2 (S3): public screen enrollment mode. Route: delegated (same writer).
- [x] T3 (S4): secretary screen flow and fallback. Route: delegated (same writer).

## Log

- L1 (user, 2026-11-09): request quoted in Problem. Plan approved with the order stats, audit, receipt PDF, this feature.

- T1 done (route: delegated writer). New in `backend/src/modules/faces`: `face-enrollment.service.ts` (one in-memory session at a time, 120 s expiry by timer and on access, first-name-only start/end events, finished sessions kept 5 min for readers), `face-enrollment.routes.ts` mounted at `/api/faces/enrollments` before the member routes (capability `faces:manage`): `POST /` (needs `consent: true`, refuses with 409 when another session is active, the member is inactive or no public screen is connected), `GET /display` (`{ connected }`), `GET /active` (`{ session }`, so a reloaded screen can recover), `GET /:id`, `POST /:id/progress`, `POST /:id/complete` (descriptor only, saves through `faceService.enroll` as the staff member who opened the session, with that consent time, audited as `create`/`update` of `face_profile`), `POST /:id/cancel`. The greeting bus gained an enrollment channel (`subscribeEnrollment`, `publishEnrollment`, `publicScreenCount`); `GET /api/access/display-events` also sends `event: enrollment`, and only a connection opened with `?screen=public` counts as a public screen (the secretary Ingreso page uses the same stream and must not count). Secretary follows by polling `GET /:id` (decision for T3: the stream is display-only and has no per-user channel; polling a small in-memory state every second is simple and survives reconnects). Audit coverage: open, progress and cancel are in the writes-nothing list (memory only); complete has its own scenario.
  - Verification: `cd backend && pnpm typecheck`: clean. `cd backend && pnpm test`: 87 files, 1376 tests passed; database tests skipped (no `TEST_DATABASE_URL`).
  - Commit: see git log.

- T2 done (route: delegated writer). The kiosk (`EntranceDisplay`) opens its stream with `?screen=public` and listens to `event: enrollment`. New `useKioskEnrollment` takes over the camera recognition already uses (no second stream): `useKioskRecognition`/`useCameraEntrance` gained `paused`, and the enrollment runs the shared `useCaptureGuide` with `addCapture` (3 consistent captures, mean descriptor). It reports hint and captures to `POST /:id/progress`, delivers only the descriptor to `/complete`, shows 4 s of confirmation, and returns to recognition on success, end event, failure (the secretary is told with status failed), camera error or the session time (local timer). A screen that connects late asks `GET /enrollments/active`. `KioskScreen` has an `enrolling` phase (large hint, "Captura n de 3", dots, first name); copy in `KIOSK_TEXT.enrolling`; API client `faces/services/enrollment-api.ts`.
  - Verification: `cd frontend && pnpm typecheck`: clean. `cd frontend && pnpm test`: 92 files, 869 tests passed. `cd frontend && pnpm build`: built (chunk-size warning only). Real camera not exercised (see S5).
  - Commit: see git log.

- T3 done (route: delegated writer). `FaceEnrollment` (member record): it checks `GET /enrollments/display` every 5 s while idle; with a public screen connected, "Registrar cara" opens a choice (consent checkbox, "Registrar en la pantalla pública", "Registrar en esta pantalla", "Cancelar"); without one it opens the camera here exactly as before. New `PublicEnrollmentFollow` shows the waiting text, "Captura n de 3", the hint the member reads, "Cancelar registro" and an opt-in "Ver cámara" (`LocalCameraPreview`: video only, no detector, released when hidden; a PC without camera says so). Progress is followed by polling `GET /enrollments/:id` every second (`useEnrollmentFollow`): the display stream is one-way, public-screen oriented and has no per-user channel, while the session is a tiny in-memory state, so polling is the simplest option that survives reloads and dropped connections; it stops on a final state, a 404 or 5 failures in a row. A session already running for the member is followed again after a reload. Completed refreshes the enrolled state; cancelled, expired, failed and lost show a Spanish message. Leaving the page does not cancel the session (it expires by itself in about 2 minutes).
  - Verification: `cd frontend && pnpm typecheck`: clean. `cd frontend && pnpm test`: 93 files, 883 tests passed. `cd frontend && pnpm build`: built (chunk-size warning only). `cd backend && pnpm typecheck` and `pnpm test`: unchanged since T1 (clean; 87 files, 1376 tests passed, database tests skipped).
  - Commit: see git log.
  - S5 not done: the automated browser has no real camera. The user must try the two windows on the front-desk PC.

## Next step

S5: the user checks the two windows with the real camera (steps in the final report of this feature).
