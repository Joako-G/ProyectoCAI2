import { useState, type FormEvent } from 'react';
import { useSaveAction } from '../hooks/useSaveAction';
import type { SurchargeTier } from '../types/pricing';
import { formatPesos } from '../utils/pricing-format';
import { validateTiers, type TierRow } from '../utils/pricing-validation';
import { SaveFeedback } from './SaveFeedback';

interface SurchargeTiersSectionProps {
  tiers: SurchargeTier[];
  canWrite: boolean;
  onSave: (tiers: SurchargeTier[]) => Promise<void>;
}

/** Late-payment surcharge tiers: a read-only table, or an editable one for those who may write. */
export function SurchargeTiersSection({ tiers, canWrite, onSave }: SurchargeTiersSectionProps) {
  const [rows, setRows] = useState<TierRow[]>(() => tiers.map(({ fromDay, amount }) => ({ fromDay: String(fromDay), amount: String(amount) })));
  const save = useSaveAction();

  function changeRow(index: number, patch: Partial<TierRow>) {
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.saving) return;
    const { tiers: valid, error } = validateTiers(rows);
    if (valid) await save.run(() => onSave(valid), 'Recargos guardados.');
    else if (error) save.fail(error);
  }

  return (
    <section className="card pricing-section" aria-labelledby="pricing-tiers-title">
      <h2 id="pricing-tiers-title" className="pricing-section__title">Recargos por pago tardío</h2>
      <p className="member-form__hint">
        Recargo por actividad según el día del mes en que se paga. Cada tramo rige hasta que empieza el siguiente.
      </p>

      {canWrite ? (
        <form className="member-form" noValidate onSubmit={handleSubmit}>
          <table className="members-table">
            <caption className="visually-hidden">Tramos de recargo</caption>
            <thead>
              <tr className="table-head">
                <th scope="col">Desde el día</th>
                <th scope="col">Recargo por actividad</th>
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                // Rows have no identity besides their position, so the index is the key.
                <tr key={index}>
                  <td><input type="text" inputMode="numeric" autoComplete="off" aria-label={`Desde el día, tramo ${index + 1}`} value={row.fromDay} onChange={(event) => changeRow(index, { fromDay: event.target.value })} /></td>
                  <td><input type="text" inputMode="numeric" autoComplete="off" aria-label={`Recargo, tramo ${index + 1}`} value={row.amount} onChange={(event) => changeRow(index, { amount: event.target.value })} /></td>
                  <td>
                    <button type="button" className="button button--secondary" aria-label={`Quitar tramo ${index + 1}`} disabled={rows.length === 1 || save.saving} onClick={() => setRows((current) => current.filter((_row, position) => position !== index))}>
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <SaveFeedback error={save.error} notice={save.notice} />
          <div className="member-form__actions">
            <button type="button" className="button button--secondary" disabled={save.saving} onClick={() => setRows((current) => [...current, { fromDay: '', amount: '' }])}>Agregar tramo</button>
            <button type="submit" className="button button--primary" disabled={save.saving}>{save.saving ? 'Guardando…' : 'Guardar recargos'}</button>
          </div>
        </form>
      ) : (
        <table className="members-table">
          <caption className="visually-hidden">Tramos de recargo</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Desde el día</th>
              <th scope="col">Recargo por actividad</th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.fromDay}>
                <td className="members-table__mono">{tier.fromDay}</td>
                <td>{formatPesos(tier.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
