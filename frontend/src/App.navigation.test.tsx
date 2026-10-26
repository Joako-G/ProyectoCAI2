import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import type { Capability } from './features/auth/types/auth';
import { buildDiscipline } from './features/disciplines/test/fixtures';
import { buildMember } from './features/members/test/fixtures';

const HEAD: Capability[] = ['members:read', 'members:write', 'disciplines:read', 'disciplines:write', 'users:manage'];
const SECRETARY: Capability[] = ['members:read', 'members:write', 'disciplines:read'];

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

function stubSession(role: string, capabilities: Capability[]) {
  const user = { id: '1', name: 'Demo', email: 'demo@example.com', role };
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    if (input === '/auth/me') return json({ user, capabilities });
    if (String(input).startsWith('/api/members/')) return json(buildMember());
    if (String(input).startsWith('/api/members')) return json([buildMember()]);
    if (String(input).startsWith('/api/disciplines')) return json([buildDiscipline()]);
    return json([]);
  }));
}

const navLinks = () => within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link');

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('role-based navigation', () => {
  it('shows the head secretary the three sections, numbered 01 to 03, and opens Socios first', async () => {
    stubSession('head_secretary', HEAD);
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Socios' })).toBeInTheDocument();
    expect(navLinks().map((link) => link.textContent)).toEqual(['01Socios', '02Disciplinas', '03Usuarios']);
  });

  it('shows the secretary Socios and Disciplinas but not Usuarios, with consecutive numbering', async () => {
    stubSession('secretary', SECRETARY);
    render(<App />);

    await screen.findByRole('heading', { level: 1, name: 'Socios' });
    expect(navLinks().map((link) => link.textContent)).toEqual(['01Socios', '02Disciplinas']);
    expect(screen.queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument();
  });

  it('keeps the member write actions for the secretary but hides the discipline ones', async () => {
    stubSession('secretary', SECRETARY);
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Alta de socio' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /Disciplinas/ }));

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Nueva disciplina' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Dar de baja / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Reactivar / })).not.toBeInTheDocument();
  });

  it('lets the secretary open a member and edit it', async () => {
    stubSession('secretary', SECRETARY);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Ríos/ }));

    expect(await screen.findByRole('button', { name: 'Editar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dar de baja' })).toBeInTheDocument();
  });

  it('shows a teacher only Mis disciplinas and loads their roster, never the member list', async () => {
    stubSession('teacher', ['roster:read']);
    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Mis disciplinas' })).toBeInTheDocument();
    expect(navLinks().map((link) => link.textContent)).toEqual(['01Mis disciplinas']);
    expect(fetch).toHaveBeenCalledWith('/api/roster', expect.anything());
    expect(fetch).not.toHaveBeenCalledWith('/api/members', expect.anything());
  });

  it('shows Precios to config:read holders, editable only with config:manage', async () => {
    const config = { tariffs: [{ effectiveFrom: '2026-10', enrollment: 1, socialFee: 1, activityFee: 1, carnetReplacement: 1 }], surchargeTiers: [{ fromDay: 1, amount: 0 }], prorationRule: { afterDay: 15, activityPercent: 50 } };
    const stub = (capabilities: Capability[]) => {
      stubSession('secretary', capabilities);
      const base = fetch as unknown as (input: RequestInfo | URL) => Promise<Response>;
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (input === '/api/pricing' ? json(config) : base(input))));
    };
    const user = userEvent.setup();

    stub([...SECRETARY, 'config:read']);
    const readOnly = render(<App />);
    await user.click(await screen.findByRole('link', { name: /Precios/ }));
    expect(await screen.findByRole('table', { name: 'Tarifas' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar tarifa' })).not.toBeInTheDocument();
    readOnly.unmount();

    stub([...SECRETARY, 'config:read', 'config:manage']);
    render(<App />);
    await user.click(await screen.findByRole('link', { name: /Precios/ }));
    expect(await screen.findByRole('button', { name: 'Agregar tarifa' })).toBeInTheDocument();
  });

  it('hides Precios from a role without config:read', async () => {
    stubSession('teacher', ['roster:read']);
    render(<App />);
    await screen.findByRole('heading', { level: 1, name: 'Mis disciplinas' });
    expect(screen.queryByRole('link', { name: /Precios/ })).not.toBeInTheDocument();
  });

  describe('Cobros', () => {
    const COLLECTOR: Capability[] = [...SECRETARY, 'payments:read', 'payments:collect'];

    function stubPayments(capabilities: Capability[]) {
      stubSession('secretary', capabilities);
      const base = fetch as unknown as (input: RequestInfo | URL) => Promise<Response>;
      vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
        if (input === '/api/payments/members/member-1/account') return json({ memberId: 'member-1', asOf: '2026-10-26', standing: 'up_to_date', unpaidPeriodCount: 0, owed: [] });
        if (input === '/api/payments/members/member-1') return json([{ id: 'pay-1', receiptNumber: 7, memberId: 'member-1', method: 'cash', paymentDate: '2026-08-20', lines: [], total: 15000, createdBy: 'u', createdAt: '2026-08-20T15:00:00.000Z' }]);
        return base(input);
      }));
    }

    async function openCobros(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('link', { name: /Cobros/ }));
      await user.type(await screen.findByLabelText('DNI del socio'), '30123456');
      await user.click(screen.getByRole('button', { name: 'Buscar' }));
      await screen.findByRole('region', { name: 'Historial de pagos' });
    }

    it('shows Cobros to payments:read holders; collecting without Anular for a secretary', async () => {
      stubPayments(COLLECTOR);
      const user = userEvent.setup();
      render(<App />);
      await openCobros(user);

      expect(screen.getByRole('heading', { level: 1, name: 'Cobros' })).toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Registrar cobro' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Anular/ })).not.toBeInTheDocument();
    });

    it('lets only payments:annul holders see Anular', async () => {
      stubPayments([...COLLECTOR, 'payments:annul']);
      const user = userEvent.setup();
      render(<App />);
      await openCobros(user);

      expect(screen.getByRole('button', { name: 'Anular comprobante 7' })).toBeInTheDocument();
    });

    it('hides Cobros from a teacher', async () => {
      stubSession('teacher', ['roster:read']);
      render(<App />);
      await screen.findByRole('heading', { level: 1, name: 'Mis disciplinas' });
      expect(screen.queryByRole('link', { name: /Cobros/ })).not.toBeInTheDocument();
    });
  });

  it('shows a role without capabilities no sections, a neutral notice, and keeps the session panel', async () => {
    stubSession('unassigned', []);
    render(<App />);

    expect(await screen.findByText('Tu rol todavía no tiene secciones disponibles.')).toBeInTheDocument();
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Sesión actual' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith('/api/members', expect.anything());
  });
});
