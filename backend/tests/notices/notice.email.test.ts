import { describe, expect, it, vi } from 'vitest';
import { buildWelcomeEmail } from '../../src/modules/notices/notice.email.js';
import { MailNotConfiguredError, MailSendError } from '../../src/modules/notices/notice.errors.js';
import { createMailer, type MailTransport } from '../../src/modules/notices/notice.mailer.js';
import { createWaMeSender } from '../../src/modules/notices/notice.sender.js';
import { createNoticeService, maskEmail, type NoticeMember } from '../../src/modules/notices/notice.service.js';
import type { Payment } from '../../src/modules/payments/payment.types.js';
import { createReceiptPdfService } from '../../src/modules/payments/receipt.service.js';
import { pdfText } from '../payments/pdf-text.js';

function member(overrides: Partial<NoticeMember> = {}): NoticeMember {
  return { id: 'm1', memberNumber: '0001', firstName: 'María', lastName: 'Pérez', whatsapp: '3815550101', status: 'active', birthDate: '1990-01-01', email: 'maria@gmail.com', ...overrides };
}

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    receiptNumber: 12,
    memberId: 'm1',
    method: 'cash',
    paymentDate: '2026-11-09',
    lines: [
      { kind: 'enrollment', period: '2026-11', amount: 10000 },
      { kind: 'activityFee', period: '2026-11', disciplineId: 'futbol', amount: 35000 },
    ],
    total: 45000,
    createdBy: 'user',
    createdAt: '2026-11-09T15:00:00.000Z',
    ...overrides,
  };
}

type SentMessage = { from: string; to: string; subject: string; text: string; html: string; attachments: Array<{ filename: string; content: Buffer; contentType: string; cid?: string }> };

function setup({ members = [member()], payments = [payment()], configured = true, transport }: { members?: NoticeMember[]; payments?: Payment[]; configured?: boolean; transport?: MailTransport } = {}) {
  const sendMail = vi.fn(async (_message: Record<string, unknown>) => ({ accepted: ['x'] }));
  const fake: MailTransport = transport ?? { sendMail };
  const disciplines = { findByIds: async () => [{ id: 'futbol', name: 'Fútbol' }] };
  const service = createNoticeService({
    members: { list: async () => members },
    memberships: { list: async () => [] },
    payments: { list: async () => payments },
    pricing: { get: async () => ({ tariffs: [], surchargeTiers: [], prorationRule: { kind: 'none' } }) as never },
    disciplines,
    sender: createWaMeSender(),
    ...(configured
      ? {
          mailer: createMailer('Secretaría <secretaria@club.test>', fake),
          receipts: createReceiptPdfService({
            payments: { getReceipt: async (id) => payments.find((current) => current.id === id)! },
            members: { getById: async (id) => members.find((current) => current.id === id)! },
            disciplines,
          }),
        }
      : {}),
  });
  return { service, sendMail };
}

const minorWithGuardian = () => member({ birthDate: '2015-06-10', guardian: { name: 'Ana Gómez', contact: '3815559999' } });

describe('maskEmail', () => {
  it('keeps the first letter and the domain', () => {
    expect(maskEmail('maria@gmail.com')).toBe('m***@gmail.com');
    expect(maskEmail('invalid')).toBe('***');
  });
});

describe('buildWelcomeEmail', () => {
  const input = { clubName: 'Club Atlético Independiente', memberName: 'Tomás Gómez', addressee: { kind: 'member' as const, name: 'María <Pérez>' }, receiptNumber: 12, paymentDate: '2026-11-09', concepts: ['Inscripción'], total: 45000, crest: true };

  it('writes the subject, a plain-text alternative and an HTML body with the crest', () => {
    const email = buildWelcomeEmail(input);
    expect(email.subject).toBe('Bienvenida a Club Atlético Independiente · Comprobante N.º 0012');
    expect(email.text).toContain('Estimada/o María <Pérez>:');
    expect(email.text).toContain('Comprobante N.º 0012 · 09/11/2026');
    expect(email.text).toContain('Total: $ 45.000');
    expect(email.html).toContain('src="cid:crest"');
    expect(email.html).toContain('Estimada/o María &lt;Pérez&gt;:');
    expect(email.html).not.toContain('<Pérez>');
  });

  it('addresses a guardian about the minor and omits the crest when it is missing', () => {
    const email = buildWelcomeEmail({ ...input, addressee: { kind: 'guardian', name: 'Ana Gómez' }, crest: false });
    expect(email.text).toContain('Registramos la inscripción de Tomás Gómez.');
    expect(email.html).not.toContain('cid:crest');
  });
});

describe('welcomeNotice email offer', () => {
  it('offers the masked address when the mailbox is configured and the member has an email', async () => {
    const notice = await setup().service.welcomeNotice('pay-1');
    expect(notice.email).toEqual({ available: true, maskedAddress: 'm***@gmail.com' });
  });

  it('says why it is not offered: not configured, no email, minor with a guardian', async () => {
    expect((await setup({ configured: false }).service.welcomeNotice('pay-1')).email).toEqual({ available: false, reason: 'mail_not_configured' });
    expect((await setup({ members: [member({ email: undefined })] }).service.welcomeNotice('pay-1')).email).toEqual({ available: false, reason: 'no_email' });
    expect((await setup({ members: [minorWithGuardian()] }).service.welcomeNotice('pay-1')).email).toEqual({ available: false, reason: 'guardian_without_email' });
  });
});

describe('sendWelcomeEmail', () => {
  it('sends the welcome to the member with the PDF attached and the crest inline', async () => {
    const { service, sendMail } = setup();
    expect(await service.sendWelcomeEmail('pay-1')).toEqual({ sent: true, maskedAddress: 'm***@gmail.com' });
    expect(sendMail).toHaveBeenCalledTimes(1);
    const message = sendMail.mock.calls[0]![0] as unknown as SentMessage;
    expect(message).toMatchObject({ from: 'Secretaría <secretaria@club.test>', to: 'maria@gmail.com', subject: 'Bienvenida a Club Atlético Independiente · Comprobante N.º 0012' });
    expect(message.text).toContain('Comprobante N.º 0012');
    expect(message.html).toContain('cid:crest');
    const pdf = message.attachments.find((attachment) => attachment.contentType === 'application/pdf')!;
    expect(pdf.filename).toBe('comprobante-0012.pdf');
    expect(pdf.content.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfText(pdf.content)).toContain('María Pérez');
    expect(message.attachments.find((attachment) => attachment.cid === 'crest')).toMatchObject({ contentType: 'image/png' });
  });

  it('refuses when the mailbox is not configured', async () => {
    await expect(setup({ configured: false }).service.sendWelcomeEmail('pay-1')).rejects.toBeInstanceOf(MailNotConfiguredError);
  });

  it('refuses a missing recipient email, a guardian-addressed minor, an unknown payment and an annulled one', async () => {
    await expect(setup({ members: [member({ email: undefined })] }).service.sendWelcomeEmail('pay-1')).rejects.toThrow('no email');
    const guardian = setup({ members: [minorWithGuardian()] });
    await expect(guardian.service.sendWelcomeEmail('pay-1')).rejects.toThrow('no email');
    expect(guardian.sendMail).not.toHaveBeenCalled();
    await expect(setup().service.sendWelcomeEmail('missing')).rejects.toThrow('Payment not found');
    const annulled = payment({ annulment: { reason: 'x', annulledBy: 'u', annulledAt: '2026-11-10T10:00:00.000Z' } });
    await expect(setup({ payments: [annulled] }).service.sendWelcomeEmail('pay-1')).rejects.toThrow('annulled');
  });

  it('hides the transport failure behind a generic error and logs only a code', async () => {
    const failure = Object.assign(new Error('connect ECONNREFUSED smtp.secret-host.test:587 user=bob'), { code: 'ECONNECTION' });
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const error = await setup({ transport: { sendMail: async () => { throw failure; } } }).service.sendWelcomeEmail('pay-1').catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(MailSendError);
      expect(String((error as Error).message)).not.toContain('secret-host');
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-host');
      expect(log).toHaveBeenCalledWith('Welcome email could not be sent', 'ECONNECTION');
    } finally {
      log.mockRestore();
    }
  });
});
