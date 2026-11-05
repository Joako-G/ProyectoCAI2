import { useRef, useState, type FormEvent } from 'react';
import { useAccessCheck } from '../hooks/useAccessCheck';
import { accessHeadline, accessMonthLine } from '../utils/access-format';

/** Container of the entrance check: type a DNI, press Enter, read a large green, yellow or red answer. */
export function AccessView() {
  const { state, check } = useAccessCheck();
  const [dni, setDni] = useState('');
  const field = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const typed = dni.trim();
    if (typed === '') return;
    const answered = await check(typed);
    // Ready for the next person; after a failure the typed DNI stays so it can be corrected.
    // A DNI typed while the check was pending belongs to the next person, so it stays too.
    if (answered) setDni((current) => (current.trim() === typed ? '' : current));
    field.current?.focus();
  }

  const monthLine = state.phase === 'done' ? accessMonthLine(state.check) : null;

  return (
    <section className="card access-view" aria-label="Ingreso">
      <form className="access-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="access-form__label">
          <span className="table-head">DNI del socio</span>
          <input
            ref={field}
            className="access-form__input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={dni}
            onChange={(event) => setDni(event.target.value)}
          />
        </label>
      </form>
      {/* Always rendered so assistive technology announces each result as it replaces the last one. */}
      <div role="status" aria-live="polite" className="access-live" data-result={state.phase === 'done' ? state.check.result : undefined}>
        {state.phase === 'checking' ? <p className="access-live__loading">Verificando…</p> : null}
        {state.phase === 'done' ? (
          <div className={`access-result access-result--${state.check.result}`}>
            <p className="access-result__headline">{accessHeadline(state.check)}</p>
            {state.check.member ? (
              <p className="access-result__member">{state.check.member.name} · N° {state.check.member.memberNumber}</p>
            ) : null}
            {monthLine ? <p className="access-result__month">{monthLine}</p> : null}
          </div>
        ) : null}
      </div>
      {state.phase === 'error' ? (
        <p className="members-page__notice members-page__notice--error" role="alert">
          <strong>No se pudo controlar el ingreso.</strong> {state.message}
        </p>
      ) : null}
    </section>
  );
}
