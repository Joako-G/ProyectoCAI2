import { useState, type FormEvent } from 'react';
import type { Discipline } from '../../disciplines/types/discipline';
import { disciplineOptionLabel } from '../../disciplines/utils/discipline-labels';
import type { MemberStatusFilter } from '../types/member';

export type CatalogPhase = 'loading' | 'error' | 'ready';

interface MembersToolbarProps {
  search: string;
  status: MemberStatusFilter;
  /** Selected discipline id; empty means every discipline. */
  disciplineId: string;
  disciplines: Discipline[];
  /** Load state of the discipline catalog; the select is only usable once it is ready. */
  catalogPhase?: CatalogPhase;
  onSearchSubmit: (search: string) => void;
  onStatusChange: (status: MemberStatusFilter) => void;
  onDisciplineChange: (disciplineId: string) => void;
  /** Opens the member creation flow (wired in a later task). */
  onCreate?: () => void;
}

const STATUS_OPTIONS: ReadonlyArray<{ value: MemberStatusFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos' },
  { value: 'inactive', label: 'Inactivos' },
];

const ALL_DISCIPLINES_LABEL: Record<CatalogPhase, string> = {
  ready: 'Todas las disciplinas',
  loading: 'Cargando disciplinas…',
  error: 'Disciplinas no disponibles',
};

export function MembersToolbar({
  search,
  status,
  disciplineId,
  disciplines,
  catalogPhase = 'ready',
  onSearchSubmit,
  onStatusChange,
  onDisciplineChange,
  onCreate,
}: MembersToolbarProps) {
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
            aria-label="Buscar socio por N° de socio, DNI, apellido o nombre"
            placeholder="N° de socio, DNI, apellido o nombre…"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
        <button type="submit" className="button button--secondary">
          Buscar
        </button>
      </form>

      <div className="segmented" role="radiogroup" aria-label="Filtrar por estado">
        {STATUS_OPTIONS.map((option) => (
          <label key={option.value} className="segmented__option">
            <input
              type="radio"
              name="member-status"
              value={option.value}
              checked={status === option.value}
              onChange={() => onStatusChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>

      <select
        className="members-toolbar__select"
        aria-label="Filtrar por disciplina"
        value={disciplineId}
        disabled={catalogPhase !== 'ready'}
        onChange={(event) => onDisciplineChange(event.target.value)}
      >
        <option value="">{ALL_DISCIPLINES_LABEL[catalogPhase]}</option>
        {disciplines.map((discipline) => (
          <option key={discipline.id} value={discipline.id}>
            {disciplineOptionLabel(discipline)}
          </option>
        ))}
      </select>

      <button type="button" className="button button--primary" onClick={onCreate}>
        Alta de socio
      </button>
    </div>
  );
}
