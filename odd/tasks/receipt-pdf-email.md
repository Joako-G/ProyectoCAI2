# Receipt PDF, professional welcome message and welcome email

Objective: when a member is enrolled, the secretary can hand over a real PDF receipt and a professional welcome message. The PDF downloads in one click so it can be attached in WhatsApp Web, and, when the club configures a mailbox and the member (or guardian) has an email, the system emails the welcome with the PDF attached. Branch: manu. Runner: vitest (backend and frontend). TDD: not configured; ordinary functional checks apply.

Requirements: RF-14 (Esencial: digital, numbered, printable receipt), RF-22 (Deseable: send the receipt to the member), RF-01 (email is an optional member field), RNF-01 (the core works offline; sending is best effort and never blocks the enrollment), RNF-09 (privacy: Ley 25.326), RN on receipts (correlative numbers, annulment keeps the receipt).

## Decisions (user, 2026-11-09)

- Delivery: the PDF is downloaded and the secretary attaches it by hand in WhatsApp Web; a `wa.me` link can only carry text, so no image or file travels through it. Email is an extra: automatic, with the PDF attached.
- The WhatsApp API (Meta Business) is out of scope.
- The club's official name is **Club Atlético Independiente** (commit 4252f08). The message must be "very professional".
- The mailbox the club sends from is not chosen yet: everything is configured through environment variables, and the feature hides itself while they are missing.

## Specs

- S1 (PDF): the backend renders one PDF per payment with `pdfkit` (pinned version, MIT): club crest (copy `frontend/public/brand/logo-cai.png` into a backend asset, do not read the frontend folder at run time), club name, "Comprobante N.º 0012", date, member name and number, the receipt lines with amounts, total, payment method if the receipt shows one today, and, for an annulled payment, a clear "ANULADO" mark with the reason (the same data `ReceiptView.tsx` shows; nothing new). Route `GET /api/payments/:id/receipt.pdf`, capability `payments:read`, `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="comprobante-0012.pdf"`. 404 for an unknown payment. One generator is used by both the download and the email.
- S2 (download UI): a "Descargar PDF" button next to "Imprimir" in the receipt modal, and in the enrollment done screen next to the WhatsApp action, with a short hint: "Descargue el PDF y adjúntelo en WhatsApp junto al mensaje."
- S3 (WhatsApp message): rewrite `buildWelcomeMessage` in a formal, professional register (usted), using WhatsApp text formatting (`*bold*`, `_italic_`, line breaks), no emoji. Shape:

  ```
  *Club Atlético Independiente*

  Estimada/o María Pérez:
  Le damos la bienvenida al club. Registramos su inscripción.

  *Comprobante N.º 0012* · 09/11/2026
  • Inscripción
  • Cuota de Fútbol noviembre de 2026
  *Total: $ 45.000*

  Le enviamos el comprobante en PDF en un mensaje aparte.
  Ante cualquier consulta, puede responder este mensaje.

  _Secretaría · Club Atlético Independiente_
  ```

  For a minor the guardian is addressed and the text says "la inscripción de {memberName}". Keep the existing recipient and number rules. Use a gender-neutral salutation ("Estimada/o" or "Hola, {name}:" — pick one, document it).
- S4 (email): `POST /api/notices/welcome/:paymentId/email`, capability `notices:read` or the capability the welcome link uses today (follow it). Uses `nodemailer` (pinned version) with SMTP settings from environment variables `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (documented in the env example and the docs; never logged). Recipient: the member's email, or the guardian's for a minor if the model has one; if there is no email, the button is not offered (the welcome endpoint reports `emailAvailable: false` and why). Subject "Bienvenida a Club Atlético Independiente · Comprobante N.º 0012"; HTML body with the crest inline, same content as S3, plain-text alternative; PDF attached. When SMTP is not configured the endpoint answers 503 `mail_not_configured` and the UI hides the button. A send failure answers 502 `mail_send_failed` with a generic message (no SMTP details); 409 for an annulled payment, as the welcome does. Sending is not stored; record the send in the audit log only if the audit module already has a fitting action, otherwise leave it out and say so.
- S5 (email UI): in the enrollment done screen, "Enviar por email a m***@gmail.com" (masked), with sending / sent / failed-with-retry states. Never blocks finishing the enrollment.
- S6: tests: PDF route (headers, 404, 401/403 via route matrix, annulled mark present in the generated text), message builder (member, guardian, annulled refusal unchanged), email route with an injected fake transport (not configured, no email, success with attachment, transport failure), UI (download link, hint, email states).

## Tasks

- [x] T1 (S1, S2): PDF generator, route, crest asset, download buttons, tests. Route: delegated (writer trigger).
- [x] T2 (S3): professional welcome message, tests. Route: delegated (same writer).
- [x] T3 (S4, S5): email sending, config, route, UI, docs, tests. Route: delegated (same writer).

## Log

- L1 (user, 2026-11-09): "cuando le das de alta tiene que enviar en PDF ese comprobante, además obvio del mensaje"; chose download + manual attach, plus email; "el mensaje de WhatsApp debe quedar re profesional con el nombre del club".
- L2 (T1): built `receipt.pdf.ts` (pdfkit, A4: crest, club name, `Comprobante N.º 0012`, date, member, payment method, lines, total, ANULADO mark with the reason), `receipt.service.ts` (one generator for download and, later, email), `GET /api/payments/:id/receipt.pdf` (`payments:read`, attachment `comprobante-0012.pdf`, 404 unknown, no-store). The crest is a backend copy at `backend/assets/logo-cai.png`, resolved from `backend/` by `RECEIPT_CREST_FILE`, so src and dist agree with no copy step. Frontend: `ReceiptPdfLink` ("Descargar PDF") in the receipt modal and in the enrollment done screen with the hint. Deps pinned: pdfkit 0.20.2, nodemailer 10.4.0 (used from T3), @types/pdfkit 0.17.7, @types/nodemailer 8.0.2. Checks: `cd backend && pnpm test` passed (node 20 passed; vitest 83 files, 1294 tests); `cd backend && pnpm typecheck` clean; `cd frontend && pnpm test` 835 passed; `cd frontend && pnpm typecheck` clean; `cd frontend && pnpm build` built (about 4 minutes). Commit: see git log.
- L3 (T2): `buildWelcomeMessage` now writes the formal WhatsApp text of S3 (usted, `*bold*`, `_italic_`, line breaks, one bullet per concept, no emoji). Salutation chosen: "Estimada/o {name}:" (gender-neutral, as in the spec shape); for a minor the guardian is addressed and the text says "la inscripción de {memberName}". Receipt number is printed as `N.º 0012` through the shared `formatReceiptNumber`. Recipient and number rules, and the refusal of an annulled payment, are unchanged. The debt message is untouched. Checks: `cd backend && pnpm test` passed (node 20 passed; vitest 83 files, 1295 tests); `cd backend && pnpm typecheck` clean. Frontend untouched in this task. Commit: see git log.
- L4 (T3): email. Config `backend/src/config/mail.ts` reads `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM` (off without `SMTP_HOST`; unusable settings are logged by variable name only). `notice.mailer.ts` wraps nodemailer behind an injectable transport; `notice.email.ts` builds subject, HTML (crest inline by cid) and plain text; `sendWelcomeEmail` attaches the PDF from the same `ReceiptPdfService`. `GET /api/notices/welcome/:id` now reports `email: { available, maskedAddress | reason }` (reasons `mail_not_configured`, `no_email`, `guardian_without_email`); `POST /api/notices/welcome/:id/email` uses `notices:read` (the capability of the welcome link), answers 200, 404, 409 (annulled or no recipient email), 503 `mail_not_configured`, 502 `mail_send_failed` (generic message, only the error code is logged). Decisions: a minor addressed through the guardian gets no email because the model stores no guardian email; audit left out because no audit action fits a send (the coverage test lists the route as writing nothing). UI: `WelcomeEmailSend` in the done screen ("Enviar por email a m***@gmail.com", sending, sent, failed with retry; never blocks Finalizar). Docs: `docs/welcome-email.md`. The environment example files could not be edited (access to them is denied in this session), so the variable block lives in the docs. Checks: `cd backend && pnpm test` passed (node 20 passed; vitest 85 files, 1314 tests); `cd backend && pnpm typecheck` clean; `cd frontend && pnpm test` passed (88 files, 840 tests); `cd frontend && pnpm typecheck` clean; `cd frontend && pnpm build` built. Commit: see git log.

## Next step

Feature complete; the secretary should set the SMTP variables when the club picks a mailbox, and review the formal wording.
