import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { dniChars } from '../../../utils/input-limits';
import type { AccessState } from '../hooks/useAccessCheck';

interface DoorCardProps {
  /** Whether the live stream of controls is connected. */
  connected: boolean;
  /** The state of the DNI check typed here. */
  check: AccessState;
  /** Asks the server about a DNI; resolves true when an answer arrived. */
  onCheck: (dni: string) => Promise<boolean>;
}

/**
 * The left card of the desk, as in the approved "Ventanilla": the door camera recognizes by itself, and the DNI field
 * is the way out when it does not. Searching by number or by name leads to Socios.
 */
export function DoorCard({ connected, check, onCheck }: DoorCardProps) {
  const [dni, setDni] = useState('');
  const field = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const typed = dni.trim();
    if (typed === '') return;
    const answered = await onCheck(typed);
    // Ready for the next person; after a failure the typed DNI stays so it can be corrected.
    // A DNI typed while the check was pending belongs to the next person, so it stays too.
    if (answered) setDni((current) => (current.trim() === typed ? '' : current));
    field.current?.focus();
  }

  return (
    <section className="card door-card" aria-label="Reconocimiento facial">
      <div className="door-card__head">
        <span className="door-card__label">RECONOCIMIENTO FACIAL</span>
        <span className={`door-card__link door-card__link--${connected ? 'on' : 'off'}`}>{connected ? '● CONECTADO' : '● RECONECTANDO'}</span>
      </div>

      <div className="door-card__ring" aria-hidden="true">
        <span className="door-card__pulse" />
        <span className="door-card__dashed" />
        <div className="door-card__core">
          <span>CÁMARA DE LA PUERTA</span>
        </div>
      </div>

      <div className="door-card__text">
        <h2 className="door-card__title">La cámara reconoce sola</h2>
        <p className="door-card__hint">Si no funciona, ingresá el DNI del socio.</p>
      </div>

      <form className="door-card__form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="door-card__field">
          <span className="visually-hidden">DNI del socio</span>
          <input
            ref={field}
            className="access-form__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="DNI del socio"
            maxLength={10}
            value={dni}
            onChange={(event) => setDni(dniChars(event.target.value))}
          />
        </label>
        <button type="submit" className="door-card__primary">Controlar DNI</button>
      </form>
      {check.phase === 'checking' ? <p className="door-card__status" role="status">Verificando…</p> : null}
      {check.phase === 'error' ? (
        <p className="members-page__notice members-page__notice--error door-card__error" role="alert">
          <strong>No se pudo controlar el ingreso.</strong> {check.message}
        </p>
      ) : null}

      <div className="door-card__row">
        <Link className="door-card__secondary" to="/socios">Buscar por N° socio</Link>
        <Link className="door-card__secondary" to="/socios">Buscar por nombre</Link>
      </div>
      {/* The greeting screen for a second monitor or another device; it keeps its own session in that window. */}
      <a className="door-card__secondary door-card__display" href="/pantalla-ingreso" target="_blank" rel="noopener noreferrer">
        Abrir pantalla pública
      </a>
    </section>
  );
}
