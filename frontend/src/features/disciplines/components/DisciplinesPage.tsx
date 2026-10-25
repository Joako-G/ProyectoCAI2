import { useState } from 'react';
import { describeError, useDisciplinesList } from '../hooks/useDisciplinesList';
import {
  ApiError,
  deactivateDiscipline,
  reactivateDiscipline,
} from '../services/disciplines-api';
import type { Discipline, DisciplineListQuery } from '../types/discipline';
import { DisciplineStatusDialog } from './DisciplineDialog';
import { DisciplinesTable } from './DisciplinesTable';
import { DisciplinesToolbar, STATUS_FILTER_LABEL } from './DisciplinesToolbar';

interface DisciplinesPageProps {
  /** Search and status filters; owned by the parent so they survive the create / edit form. */
  query: DisciplineListQuery;
  onQueryChange: (query: DisciplineListQuery) => void;
  /** Whether to offer create, edit, deactivate and reactivate. */
  canWrite?: boolean;
  onCreate: () => void;
  onEdit: (discipline: Discipline) => void;
}

interface PendingAction {
  action: 'deactivate' | 'reactivate';
  discipline: Discipline;
}

function resultsLabel(count: number): string {
  return `${count} ${count === 1 ? 'resultado' : 'resultados'}`;
}

/** Container: fetches the disciplines, composes toolbar and table and runs the status actions. */
export function DisciplinesPage({ query, onQueryChange, canWrite = true, onCreate, onEdit }: DisciplinesPageProps) {
  const { search, status } = query;
  const { state, reload } = useDisciplinesList(query);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string>();
  /** Message of an action that failed because the discipline changed or vanished; survives the reload. */
  const [staleNotice, setStaleNotice] = useState<string>();

  function closeDialog() {
    setPending(null);
    setActionError(undefined);
  }

  // Submitting the same text again acts as a refresh: the unchanged query alone would not refetch.
  function submitSearch(next: string) {
    onQueryChange({ ...query, search: next });
    reload();
  }

  async function confirm() {
    if (!pending) return;
    const { action, discipline } = pending;
    setSaving(true);
    setActionError(undefined);
    setStaleNotice(undefined);
    try {
      await (action === 'deactivate' ? deactivateDiscipline : reactivateDiscipline)(discipline.id);
      setPending(null);
      reload();
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
        // The discipline changed or was removed elsewhere: drop the dialog and reload the real state.
        setStaleNotice(error.message);
        setPending(null);
        reload();
      } else {
        setActionError(describeError(error));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card members-page" aria-label="Disciplinas">
      <DisciplinesToolbar
        search={search}
        status={status}
        onSearchSubmit={submitSearch}
        onStatusChange={(next) => onQueryChange({ ...query, status: next })}
        canCreate={canWrite}
        onCreate={onCreate}
      />

      <div className="members-page__summary">
        Filtro: <strong>{STATUS_FILTER_LABEL[status]}</strong>
        {state.phase === 'ready' ? (
          <>
            {' · '}
            <span>{resultsLabel(state.disciplines.length)}</span>
          </>
        ) : null}
      </div>

      {staleNotice ? (
        <p className="form-alert" role="alert">
          {staleNotice}
        </p>
      ) : null}

      {state.phase === 'loading' ? (
        <p className="members-page__notice" role="status">
          Cargando disciplinas…
        </p>
      ) : null}

      {state.phase === 'error' ? (
        <div className="members-page__notice members-page__notice--error" role="alert">
          <p>
            <strong>No se pudo cargar el listado.</strong> {state.message}
          </p>
          <button type="button" className="button button--secondary" onClick={reload}>
            Reintentar
          </button>
        </div>
      ) : null}

      {state.phase === 'ready' && state.disciplines.length === 0 ? (
        <p className="members-page__notice">No hay disciplinas que coincidan con la búsqueda o el filtro.</p>
      ) : null}

      {state.phase === 'ready' && state.disciplines.length > 0 ? (
        <DisciplinesTable
          disciplines={state.disciplines}
          canWrite={canWrite}
          onEdit={onEdit}
          onDeactivate={(discipline) => setPending({ action: 'deactivate', discipline })}
          onReactivate={(discipline) => setPending({ action: 'reactivate', discipline })}
        />
      ) : null}

      {pending ? (
        <DisciplineStatusDialog
          action={pending.action}
          disciplineName={pending.discipline.name}
          saving={saving}
          error={actionError}
          onCancel={closeDialog}
          onConfirm={confirm}
        />
      ) : null}
    </section>
  );
}
