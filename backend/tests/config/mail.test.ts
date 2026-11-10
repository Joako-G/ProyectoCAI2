import { describe, expect, it } from 'vitest';
import { mailConfig } from '../../src/config/mail.js';

describe('mailConfig', () => {
  it('is off without SMTP_HOST', () => {
    expect(mailConfig({})).toEqual({ state: 'not_configured' });
    expect(mailConfig({ SMTP_HOST: '  ', MAIL_FROM: 'a@club.test' })).toEqual({ state: 'not_configured' });
  });

  it('reads the connection with STARTTLS defaults and optional credentials', () => {
    expect(mailConfig({ SMTP_HOST: 'smtp.club.test', MAIL_FROM: 'Secretaría <s@club.test>' })).toEqual({
      state: 'configured',
      config: { host: 'smtp.club.test', port: 587, secure: false, from: 'Secretaría <s@club.test>' },
    });
    expect(mailConfig({ SMTP_HOST: 'h', MAIL_FROM: 'f@club.test', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASSWORD: 'p' })).toEqual({
      state: 'configured',
      config: { host: 'h', port: 465, secure: true, from: 'f@club.test', auth: { user: 'u', password: 'p' } },
    });
    expect(mailConfig({ SMTP_HOST: 'h', MAIL_FROM: 'f@club.test', SMTP_PORT: '2525' })).toMatchObject({ config: { port: 2525 } });
  });

  it('reports unusable settings by name and never echoes a value', () => {
    const result = mailConfig({ SMTP_HOST: 'h', SMTP_PORT: 'abc', SMTP_SECURE: 'maybe', SMTP_USER: 'secret-user' });
    expect(result.state).toBe('invalid');
    const text = JSON.stringify(result);
    expect(text).toContain('MAIL_FROM');
    expect(text).toContain('SMTP_PORT');
    expect(text).toContain('SMTP_SECURE');
    expect(text).toContain('SMTP_PASSWORD');
    expect(text).not.toContain('secret-user');
  });
});
