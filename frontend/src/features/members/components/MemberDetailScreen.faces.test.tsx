import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildMember, jsonResponse } from '../test/fixtures';
import type { Member } from '../types/member';
import { MemberDetailScreen } from './MemberDetailScreen';

afterEach(() => vi.unstubAllGlobals());

function stubApi(member: Member) {
  const fetchMock = vi.fn(async (url: string) => (url.startsWith('/api/faces/') ? jsonResponse({ enrolled: false }) : jsonResponse(member)));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const catalog = { state: { phase: 'ready' as const, disciplines: [] }, retry: () => undefined };

function renderScreen(props: { canManageFaces?: boolean }) {
  render(<MemberDetailScreen id="member-1" today="2026-10-05" catalog={catalog} canWrite onBack={() => undefined} onEdit={() => undefined} {...props} />);
}

describe('MemberDetailScreen face block', () => {
  it('shows "Reconocimiento facial" to staff who can manage faces', async () => {
    const fetchMock = stubApi(buildMember());
    renderScreen({ canManageFaces: true });
    expect(await screen.findByRole('heading', { name: 'Reconocimiento facial' })).toBeInTheDocument();
    expect(await screen.findByText('Sin cara registrada')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/faces/member-1', expect.anything());
  });

  it('hides the block, and never asks for faces, without the capability', async () => {
    const fetchMock = stubApi(buildMember());
    renderScreen({ canManageFaces: false });
    await screen.findByRole('heading', { level: 2, name: 'Lucía Ríos' });
    expect(screen.queryByRole('heading', { name: 'Reconocimiento facial' })).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).startsWith('/api/faces/'))).toBe(false);
  });

  it('hides the block for an inactive member, whose face is deleted on deactivation', async () => {
    stubApi(buildMember({ status: 'inactive', deactivation: { date: '2026-10-01', reason: 'Baja voluntaria' } }));
    renderScreen({ canManageFaces: true });
    await screen.findByText('Baja registrada');
    expect(screen.queryByRole('heading', { name: 'Reconocimiento facial' })).not.toBeInTheDocument();
  });
});
