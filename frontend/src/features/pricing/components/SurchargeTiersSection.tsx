import { useState, type FormEvent } from 'react';
import { digitsOnly, MONEY_INPUT_MAX_LENGTH, moneyChars } from '../../../utils/input-limits';
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
          <table className="members-table members-table--stack">
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
                  <td data-label="Desde el día"><input type="text" inputMode="numeric" autoComplete="off" aria-label={`Desde el día, tramo ${index + 1}`} maxLength={2} value={row.fromDay} onChange={(event) => changeRow(index, { fromDay: digitsOnly(event.target.value, 2) })} /></td>
                  <td data-label="Recargo por actividad"><input type="text" inputMode="numeric" autoComplete="off" aria-label={`Recargo, tramo ${index + 1}`} maxLength={MONEY_INPUT_MAX_LENGTH} value={row.amount} onChange={(event) => changeRow(index, { amount: moneyChars(event.target.value) })} /></td>
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
        <table className="members-table members-table--stack">
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
                <td className="members-table__mono" data-label="Desde el día">{tier.fromDay}</td>
                <td data-label="Recargo por actividad">{formatPesos(tier.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
