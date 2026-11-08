import { render, screen, within } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { buildResultView } from '../utils/kiosk-texts';
import { FALLBACK_FRAME } from '../utils/pane-geometry';
import { KioskScreen, type KioskScreenProps } from './KioskScreen';

const member = { id: 'm1', memberNumber: '1042', fullName: 'Valentina Ríos', firstName: 'Valentina', disciplines: [] as string[] };
const greenResult = buildResultView({ at: 'x', tone: 'welcome', kind: 'up_to_date', method: 'face', firstName: 'Valentina', member, paidThrough: '2026-08', dueDate: '2026-09-10' });
const strangerResult = buildResultView({ at: 'x', tone: 'refused', kind: 'not_recognized', method: 'face' });

function setup(overrides: Partial<KioskScreenProps> = {}) {
  const props: KioskScreenProps = {
    phase: 'idle',
    clock: '18:42:07',
    frame: FALLBACK_FRAME,
    camera: { phase: 'ready' },
    videoRef: createRef<HTMLVideoElement>(),
    connected: true,
    scale: 1,
    ...overrides,
  };
  return render(<KioskScreen {...props} />);
}

const stage = () => screen.getByTestId('kiosk-stage');

describe('KioskScreen layout', () => {
  it('draws the stage at the reference size and scales it from its center', () => {
    setup({ scale: 0.5 });
    expect(stage()).toHaveStyle({ width: '1180px', height: '700px', transform: 'scale(0.5)' });
  });

  it('wraps everything in the kiosk class so reduced motion applies', () => {
    setup();
    expect(screen.getByRole('main', { name: 'Pantalla de ingreso' })).toHaveClass('kiosk');
  });
});

describe('KioskScreen idle', () => {
  it('shows the crest, the welcome, the help and the fallback box', () => {
    setup();
    expect(screen.getByAltText('Escudo del Club Independiente')).toHaveAttribute('src', '/brand/logo-cai.png');
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
    expect(screen.getByText('Mirá a la cámara para ingresar. No hace falta el carnet ni el DNI.')).toBeInTheDocument();
    expect(screen.getByText(/¿No funciona\?/)).toHaveTextContent('¿No funciona? Pedí ayuda en secretaría: te buscan por DNI.');
    expect(stage()).toHaveAttribute('data-tone', 'idle');
  });

  it('labels the frame, waits with the standard caption and shows the clock', () => {
    setup();
    expect(screen.getByText('BUSCANDO ROSTRO')).toBeInTheDocument();
    expect(screen.getByText('EN ESPERA · ACERCATE Y MIRÁ A LA CÁMARA')).toBeInTheDocument();
    expect(screen.getByText('18:42:07')).toBeInTheDocument();
    expect(screen.getByText('CÁMARA DE ACCESO · EN VIVO')).toBeInTheDocument();
  });

  it('shows the live hint of the capture guide instead of the standard caption', () => {
    setup({ hint: 'Acercate' });
    expect(screen.getByText('Acercate')).toBeInTheDocument();
    expect(screen.queryByText('EN ESPERA · ACERCATE Y MIRÁ A LA CÁMARA')).not.toBeInTheDocument();
  });

  it('puts the framing rectangle where the detected face is, and where the design has it otherwise', () => {
    const { rerender } = setup();
    expect(screen.getByTestId('kiosk-frame')).toHaveStyle({ left: '224px', top: '201px', width: '262px', height: '230px' });
    rerender(
      <KioskScreen phase="idle" clock="18:42:07" frame={{ left: 300, top: 120, width: 180, height: 200 }} camera={{ phase: 'ready' }} videoRef={createRef()} connected scale={1} />,
    );
    expect(screen.getByTestId('kiosk-frame')).toHaveStyle({ left: '300px', top: '120px', width: '180px', height: '200px' });
  });

  it('follows the face smoothly: the frame moves with a short transition', () => {
    setup();
    expect(screen.getByTestId('kiosk-frame').className).toContain('kiosk-frame');
  });

  it('plays the camera when it is ready, with a clear line and the design placeholder when it is not', () => {
    const { unmount } = setup();
    expect(screen.getByLabelText('Vista de la cámara')).toBeInTheDocument();
    expect(screen.queryByText('VISTA DE LA CÁMARA')).not.toBeInTheDocument();
    unmount();
    setup({ camera: { phase: 'error', message: 'No se encontró ninguna cámara en este equipo.' } });
    expect(screen.queryByLabelText('Vista de la cámara')).not.toBeInTheDocument();
    expect(screen.getByText('VISTA DE LA CÁMARA')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('No se encontró ninguna cámara en este equipo.');
    expect(screen.getByRole('heading', { name: 'Bienvenido al club' })).toBeInTheDocument();
  });

  it('says so while the camera is starting', () => {
    setup({ camera: { phase: 'starting' } });
    expect(screen.getByText('Preparando la cámara…')).toBeInTheDocument();
  });

  it('shows a quiet notice while the stream is down', () => {
    setup({ connected: false });
    expect(screen.getByText('Reconectando…')).toBeInTheDocument();
  });
});

describe('KioskScreen identifying', () => {
  it('asks the person to hold still and shows the comparison with the number of members', () => {
    setup({ phase: 'identifying', enrolled: 312 });
    expect(screen.getByText('IDENTIFICANDO')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quedate quieto un segundo…' })).toBeInTheDocument();
    expect(screen.getByText('Estamos verificando tu rostro y el estado de tu cuota.')).toBeInTheDocument();
    expect(screen.getByText('ANALIZANDO ROSTRO')).toBeInTheDocument();
    expect(screen.getByText('COMPARANDO CON EL PADRÓN · 312 SOCIOS')).toBeInTheDocument();
    expect(screen.getByText('NO SE GUARDA LA IMAGEN')).toBeInTheDocument();
    expect(stage()).toHaveAttribute('data-tone', 'scanning');
  });

  it('leaves the number out when it is not known, and never invents a match percentage', () => {
    setup({ phase: 'identifying' });
    expect(screen.getByText('COMPARANDO CON EL PADRÓN')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/%/);
  });
});

describe('KioskScreen result', () => {
  it('shows the member card with initials, the fee, the message, the detail row and the footer', () => {
    setup({ phase: 'result', result: greenResult, resultTime: '12:30' });
    expect(stage()).toHaveAttribute('data-tone', 'green');
    expect(screen.getByText('ACCESO AUTORIZADO')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Pasá, Valentina' })).toBeInTheDocument();
    const card = screen.getByTestId('kiosk-card');
    expect(within(card).getByText('Valentina Ríos')).toBeInTheDocument();
    expect(within(card).getByText('VR')).toBeInTheDocument();
    expect(within(card).getByText('1042')).toBeInTheDocument();
    expect(within(card).getByText('AL DÍA')).toBeInTheDocument();
    expect(screen.getByText('Tu cuota está paga hasta agosto 2026.')).toBeInTheDocument();
    expect(screen.getByText('Próximo vencimiento')).toBeInTheDocument();
    expect(screen.getByText('10/09/2026')).toBeInTheDocument();
    expect(screen.getByText('ACCESO REGISTRADO · PUERTA PRINCIPAL')).toBeInTheDocument();
    expect(screen.getByText('ROSTRO IDENTIFICADO')).toBeInTheDocument();
    expect(screen.getByText('REGISTRADO EN EL SISTEMA · 12:30')).toBeInTheDocument();
    expect(screen.queryByText('FOTO SOCIO')).not.toBeInTheDocument();
  });

  it('shows no card and no member data when nobody was recognized', () => {
    setup({ phase: 'result', result: strangerResult, resultTime: '12:30' });
    expect(stage()).toHaveAttribute('data-tone', 'dark');
    expect(screen.getByText('NO PUDIMOS RECONOCERTE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Probá otra vez' })).toBeInTheDocument();
    expect(screen.queryByTestId('kiosk-card')).not.toBeInTheDocument();
    expect(screen.queryByText('N° SOCIO')).not.toBeInTheDocument();
    expect(screen.getByText('SIEMPRE PODÉS PEDIR AYUDA EN SECRETARÍA')).toBeInTheDocument();
    expect(screen.getByText('SIN COINCIDENCIA')).toBeInTheDocument();
  });

  it.each([
    ['amber', 'debtor', 'see_desk'],
    ['red', 'deregistered', 'refused'],
    ['gray', 'inactive', 'refused'],
  ] as const)('uses the %s palette for %s', (tone, kind, eventTone) => {
    const result = buildResultView({ at: 'x', tone: eventTone, kind, method: 'face', firstName: 'Valentina', member, debtSince: '2026-06' });
    setup({ phase: 'result', result, resultTime: '12:30' });
    expect(stage()).toHaveAttribute('data-tone', tone);
  });
});

describe('KioskScreen out of service', () => {
  it('says the recognition is not available in the gray state', () => {
    setup({ phase: 'unavailable' });
    expect(stage()).toHaveAttribute('data-tone', 'gray');
    expect(screen.getByRole('heading', { name: 'Reconocimiento no disponible: pedí ayuda en secretaría' })).toBeInTheDocument();
  });

  it('says the session ended and links to sign in again', () => {
    setup({ phase: 'expired', signInHref: '/pantalla-ingreso' });
    expect(screen.getByRole('heading', { name: 'Sesión vencida: iniciá sesión en esta PC' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute('href', '/pantalla-ingreso');
  });
});
