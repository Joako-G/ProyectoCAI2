# Welcome email and receipt PDF

After an enrollment the secretary can hand over the receipt in two ways:

- **PDF download.** "Descargar PDF" (receipt window and enrollment done screen) saves `comprobante-0012.pdf`. The secretary attaches it by hand in WhatsApp Web next to the welcome message: a `wa.me` link can only carry text.
- **Email (optional).** When the club configures a mailbox and the member has an email, "Enviar por email a m***@gmail.com" sends the welcome with the same PDF attached. Sending is best effort and never blocks finishing the enrollment (RNF-01).

## Configuration

The mailbox is configured only through environment variables of the backend process (never committed, never logged). Without `SMTP_HOST` the email button is hidden and `POST /api/notices/welcome/:paymentId/email` answers `503 mail_not_configured`.

| Variable | Required | Meaning |
| --- | --- | --- |
| `SMTP_HOST` | yes | SMTP server host name. Leaving it empty turns the feature off. |
| `MAIL_FROM` | yes | Sender shown to the recipient, for example `Secretaría <secretaria@club.example>`. |
| `SMTP_PORT` | no | Defaults to `587` (or `465` when `SMTP_SECURE=true`). |
| `SMTP_SECURE` | no | `true` for implicit TLS (usually port 465); `false` for STARTTLS (587). Defaults to `false`. |
| `SMTP_USER` | no | Account name. Set it together with `SMTP_PASSWORD`. |
| `SMTP_PASSWORD` | no | Account password or app password. |

Example block for the backend `.env` (do not commit real values):

```
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
```

If some variables are set but unusable (for example `SMTP_USER` without `SMTP_PASSWORD`), the server logs which variable names are wrong, never their values, and the feature stays off.

## Rules

- **Recipient.** The member's own email. A minor with a guardian is written to through the guardian, and the model stores no email for a guardian, so no email is offered for that case (`guardian_without_email`). The guardian is still reached by WhatsApp.
- **Annulled payment.** The welcome (WhatsApp and email) answers `409`; the PDF can still be downloaded and carries an ANULADO mark with the reason.
- **Failures.** A clear rejection before the message was sent (error codes `EAUTH`, `ECONNREFUSED`, `ENOTFOUND`, `EDNS`, `EENVELOPE`, `ETLS`) answers `502 mail_send_failed` with a generic message and allows a normal retry. Any other failure, a timeout or a lost connection, may have happened after the server accepted the message, so it is **uncertain**: `504 mail_send_uncertain`. When unsure, the code is treated as uncertain. Only the error code is logged, never credentials or full addresses.
- **Bounded send.** The whole send is bounded to 15 s on the server (SMTP connection and greeting timeouts of 5 s, socket timeout of 10 s, and an overall timer). The browser aborts its request after 20 s and also treats that as uncertain.
- **No duplicate sends.** The server remembers, per payment, whether a welcome email is being sent, was sent (time and masked address) or ended uncertain. A send while one is running answers `409 mail_send_in_progress`. A payment already sent, or uncertain, answers `409 mail_already_sent` (with `lastSend`) unless the request body says `{ "resend": true }`. The screen asks for confirmation before resending. `GET /api/notices/welcome/:paymentId` reports it as `email.lastSend: { status, at, to }`, so a remounted screen shows "Enviado el dd/mm/aaaa hh:mm a m***@..." instead of the send button.
- **Lost on restart.** This state lives in server memory only (a small injectable store). Restarting the server forgets it, so after a restart a second send is possible again.
- **Audit.** The send is not recorded: the audit log has no action that fits a send (its actions are create, update, deactivate, reactivate, delete, annul and close).
- **Privacy (RNF-09).** The API returns the address masked (`m***@gmail.com`); only the masked address and the time of the last send are kept, in memory.

## Endpoints

| Method and path | Capability | Notes |
| --- | --- | --- |
| `GET /api/payments/:id/receipt.pdf` | `payments:read` | Attachment `comprobante-NNNN.pdf`; `404` for an unknown payment. |
| `GET /api/notices/welcome/:paymentId` | `notices:read` | Adds `email`: `{ available: true, maskedAddress, lastSend? }` or `{ available: false, reason }`. |
| `POST /api/notices/welcome/:paymentId/email` | `notices:read` | Optional body `{ resend: true }`. `200 { sent: true, maskedAddress, sentAt }`, `503`, `502`, `504 mail_send_uncertain`, `409` (annulled, no email, `mail_send_in_progress`, `mail_already_sent`), `404`. |
