import { useState } from 'react';
import { useSaveAction } from '../hooks/useSaveAction';
import type { Tariff } from '../types/pricing';
import { formatPesos, formatPeriod } from '../utils/pricing-format';
import { SaveFeedback } from './SaveFeedback';
import { TariffForm } from './TariffForm';

interface TariffsSectionProps {
  tariffs: Tariff[];
  /** Current month (`YYYY-MM`): tariffs before it are read-only history. */
  month: string;
  canWrite: boolean;
  onAdd: (tariff: Tariff) => Promise<void>;
  onReplace: (tariff: Tariff) => Promise<void>;
  onDelete: (effectiveFrom: string) => Promise<void>;
}

/** Tariff history plus, for those who may write, the add / edit form and delete confirmation. */
export function TariffsSection({ tariffs, month, canWrite, onAdd, onReplace, onDelete }: TariffsSectionProps) {
  const [editing, setEditing] = useState<Tariff>();
  const [confirming, setConfirming] = useState<string>();
  const [addFormKey, setAddFormKey] = useState(0);
  const save = useSaveAction();

  const sorted = [...tariffs].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  // The latest tariff that has already started is the one charged this month.
  const inForce = sorted.filter((tariff) => tariff.effectiveFrom <= month).at(-1)?.effectiveFrom;

  const statusOf = (effectiveFrom: string) =>
    effectiveFrom === inForce ? 'Vigente' : effectiveFrom > month ? 'Próxima' : 'Anterior';

  async function submitAdd(tariff: Tariff) {
    if (await save.run(() => onAdd(tariff), 'Tarifa guardada.')) setAddFormKey((key) => key + 1);
  }

  async function submitEdit(tariff: Tariff) {
    if (await save.run(() => onReplace(tariff), 'Tarifa guardada.')) setEditing(undefined);
  }

  async function confirmDelete(effectiveFrom: string) {
    const deleted = await save.run(() => onDelete(effectiveFrom), 'Tarifa eliminada.');
    // The tariff no longer exists, so an open edit form for it would only fail with a 404.
    if (deleted) setEditing((open) => (open?.effectiveFrom === effectiveFrom ? undefined : open));
    setConfirming(undefined);
  }

  return (
    <section className="card pricing-section" aria-labelledby="pricing-tariffs-title">
      <h2 id="pricing-tariffs-title" className="pricing-section__title">Tarifas</h2>
      <p className="member-form__hint">
        Cada tarifa rige desde su mes hasta que empieza la siguiente. Las tarifas de meses pasados quedan como historial y no se modifican.
      </p>

      {sorted.length === 0 ? (
        <p className="members-page__notice">Todavía no hay tarifas cargadas.</p>
      ) : (
        <table className="members-table">
          <caption className="visually-hidden">Tarifas</caption>
          <thead>
            <tr className="table-head">
              <th scope="col">Vigente desde</th>
              <th scope="col">Matrícula</th>
              <th scope="col">Cuota social</th>
              <th scope="col">Cuota por actividad</th>
              <th scope="col">Reposición de carnet</th>
              <th scope="col">Estado</th>
              {canWrite ? <th scope="col">Acciones</th> : null}
            </tr>
          </thead>
          <tbody>
            {sorted.map((tariff) => {
              const status = statusOf(tariff.effectiveFrom);
              const period = formatPeriod(tariff.effectiveFrom);
              return (
                <tr key={tariff.effectiveFrom}>
                  <td className="members-table__mono">{period}</td>
                  <td>{formatPesos(tariff.enrollment)}</td>
                  <td>{formatPesos(tariff.socialFee)}</td>
                  <td>{formatPesos(tariff.activityFee)}</td>
                  <td>{formatPesos(tariff.carnetReplacement)}</td>
                  <td>
                    <span className={`status-chip status-chip--${status === 'Vigente' ? 'active' : 'inactive'}`}>{status}</span>
                  </td>
                  {canWrite ? (
                    <td>
                      {tariff.effectiveFrom < month ? null : confirming === tariff.effectiveFrom ? (
                        <div className="disciplines-table__actions">
                          <button type="button" className="button button--danger" disabled={save.saving} onClick={() => confirmDelete(tariff.effectiveFrom)}>
                            Confirmar eliminación
                          </button>
                          <button type="button" className="button button--secondary" disabled={save.saving} onClick={() => setConfirming(undefined)}>Cancelar</button>
                        </div>
                      ) : (
                        <div className="disciplines-table__actions">
                          <button type="button" className="button button--secondary" aria-label={`Editar tarifa ${period}`} onClick={() => setEditing(tariff)}>Editar</button>
                          <button type="button" className="button button--secondary" aria-label={`Eliminar tarifa ${period}`} onClick={() => setConfirming(tariff.effectiveFrom)}>Eliminar</button>
                        </div>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <SaveFeedback error={save.error} notice={save.notice} />

      {canWrite ? (
        editing ? (
          <TariffForm key={editing.effectiveFrom} tariff={editing} month={month} saving={save.saving} onSubmit={submitEdit} onCancel={() => setEditing(undefined)} />
        ) : (
          <TariffForm key={addFormKey} month={month} saving={save.saving} onSubmit={submitAdd} />
        )
      ) : null}
    </section>
  );
}
