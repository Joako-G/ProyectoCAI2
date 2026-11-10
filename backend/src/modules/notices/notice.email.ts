import { formatClubDate, formatPesos, formatReceiptNumber } from '../payments/receipt.format.js';

export interface WelcomeEmailInput {
  clubName: string;
  memberName: string;
  /** Who reads the email: the member, or the guardian of a minor. */
  addressee: { kind: 'member' | 'guardian'; name: string };
  receiptNumber: number;
  paymentDate: string;
  /** What the receipt charged, already worded in Spanish. */
  concepts: readonly string[];
  total: number;
  /** Whether the crest is attached inline as `cid:crest`. */
  crest: boolean;
}

export interface WelcomeEmail {
  subject: string;
  text: string;
  html: string;
}

export const CREST_CID = 'crest';

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The welcome email: same content as the WhatsApp text, in formal Spanish, with an HTML body and a plain-text alternative. Pure. */
export function buildWelcomeEmail({ clubName, memberName, addressee, receiptNumber, paymentDate, concepts, total, crest }: WelcomeEmailInput): WelcomeEmail {
  const number = formatReceiptNumber(receiptNumber);
  const date = formatClubDate(paymentDate);
  const enrollment = addressee.kind === 'guardian' ? `la inscripción de ${memberName}` : 'su inscripción';
  const salutation = `Estimada/o ${addressee.name}:`;
  const welcome = `Le damos la bienvenida al club. Registramos ${enrollment}.`;
  const heading = `Comprobante N.º ${number} · ${date}`;
  const totalLine = `Total: ${formatPesos(total)}`;
  const attached = 'Adjuntamos el comprobante en PDF.';
  const contact = 'Ante cualquier consulta, puede responder este correo.';
  const signature = `Secretaría · ${clubName}`;

  const text = [
    clubName,
    '',
    salutation,
    welcome,
    '',
    heading,
    ...concepts.map((concept) => `- ${concept}`),
    totalLine,
    '',
    attached,
    contact,
    '',
    signature,
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #dcdfe4;border-radius:6px;">
<tr><td style="padding:24px 28px;border-bottom:1px solid #dcdfe4;">
${crest ? `<img src="cid:${CREST_CID}" alt="" width="56" height="56" style="vertical-align:middle;margin-right:12px;">` : ''}<span style="font-size:18px;font-weight:bold;vertical-align:middle;">${escapeHtml(clubName)}</span>
</td></tr>
<tr><td style="padding:24px 28px;font-size:15px;line-height:1.5;">
<p style="margin:0 0 12px;">${escapeHtml(salutation)}</p>
<p style="margin:0 0 20px;">${escapeHtml(welcome)}</p>
<p style="margin:0 0 8px;"><strong>${escapeHtml(heading)}</strong></p>
<ul style="margin:0 0 12px;padding-left:20px;">
${concepts.map((concept) => `<li>${escapeHtml(concept)}</li>`).join('\n')}
</ul>
<p style="margin:0 0 20px;"><strong>${escapeHtml(totalLine)}</strong></p>
<p style="margin:0 0 4px;">${escapeHtml(attached)}</p>
<p style="margin:0 0 20px;">${escapeHtml(contact)}</p>
<p style="margin:0;color:#5f6368;font-style:italic;">${escapeHtml(signature)}</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>
`;

  return { subject: `Bienvenida a ${clubName} · Comprobante N.º ${number}`, text, html };
}
