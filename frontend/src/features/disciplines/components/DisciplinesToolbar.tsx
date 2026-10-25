import { useState, type FormEvent } from 'react';
import type { DisciplineStatusFilter } from '../types/discipline';

interface DisciplinesToolbarProps {
  search: string;
  status: DisciplineStatusFilter;
  onSearchSubmit: (search: string) => void;
  onStatusChange: (status: DisciplineStatusFilter) => void;
  /** Whether to offer the create action. */
  canCreate: boolean;
  onCreate: () => void;
}

export const STATUS_FILTER_LABEL = { all: 'Todas', active: 'Activas', inactive: 'Inactivas' } as const;
const STATUS_VALUES: readonly DisciplineStatusFilter[] = ['all', 'active', 'inactive'];

export function DisciplinesToolbar({
  search,
  status,
  onSearchSubmit,
  onStatusChange,
  canCreate,
  onCreate,
}:DisciplinesToolbarProps) {
  const [draft, setDraft] = useState(search);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearchSubmit(draft);
  }

  return (
    <div className="members-toolbar">
      <form className="members-toolbar__search" role="search" onSubmit={handleSubmit}>
        <label className="members-toolbar__search-field">
          <span className="members-toolbar__search-label table-head">Buscar</span>
          <input
            type="search"
            aria-label="Buscar disciplina por nombre"
            placeholder="Nombre de la disciplina…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button type="submit" className="button button--secondary">
          Buscar
        </button>
      </form>

      <div className="segmented" role="radiogroup" aria-label="Filtrar por estado">
        {STATUS_VALUES.map((value) => (
          <label key={value} className="segmented__option">
            <input
              type="radio"
              name="discipline-status"
              value={value}
              checked={status === value}
              onChange={() => onStatusChange(value)}
            />
            <span>{STATUS_FILTER_LABEL[value]}</span>
          </label>
        ))}
      </div>

      {canCreate ? (
        <button type="button" className="button button--primary" onClick={onCreate}>
          Nueva disciplina
        </button>
      ) : null}
    </div>
  );
}
