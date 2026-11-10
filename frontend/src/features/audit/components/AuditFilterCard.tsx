import { roleLabel } from '../../users/utils/user-format';
import type { AuditActor, AuditFilters } from '../types/audit';
import { activeQuickRange, filterChips, hasActiveFilters, QUICK_RANGES, quickRange, type QuickRange } from '../utils/audit-filters';
import { actionLabel, AUDIT_ACTIONS, AUDIT_ENTITY_TYPES, entityTypeLabel } from '../utils/audit-format';

interface AuditFilterCardProps {
  filters: AuditFilters;
  actors: readonly AuditActor[];
  onChange: (patch: Partial<AuditFilters>) => void;
  onClear: () => void;
}

/** The filter card of the audit screen: the controls, the quick date ranges and a removable chip per filter in use. */
export function AuditFilterCard({ filters, actors, onChange, onClear }: AuditFilterCardProps) {
  const chips = filterChips(filters, actors);
  const activeRange = activeQuickRange(filters);
  // A user chosen from a shared link who is not (yet) in the list still has to show as selected.
  const knownActor = !filters.actorId || actors.some((actor) => actor.id === filters.actorId);

  return (
    <form className="card desk-card desk-form audit-filters" aria-label="Filtros de la auditoría" onSubmit={(event) => event.preventDefault()}>
      <div className="desk-card__head">
        <span className="desk-card__label">Filtros</span>
      </div>

      <div className="audit-filters__grid">
        <div className="desk-field">
          <label className="desk-field__label" htmlFor="audit-actor">Usuario</label>
          <select id="audit-actor" className="desk-input" value={filters.actorId} onChange={(event) => onChange({ actorId: event.target.value })}>
            <option value="">Todos los usuarios</option>
            {!knownActor && <option value={filters.actorId}>Usuario seleccionado</option>}
            {actors.map((actor) => (
              <option key={actor.id} value={actor.id}>{actor.name} ({roleLabel(actor.role)})</option>
            ))}
          </select>
        </div>

        <div className="desk-field">
          <label className="desk-field__label" htmlFor="audit-member">Socio</label>
          <input
            id="audit-member"
            className="desk-input"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            placeholder="N.º de socio, ej. 0007"
            value={filters.member}
            onChange={(event) => onChange({ member: event.target.value.replace(/\D/g, '').slice(0, 10) })}
          />
        </div>

        <div className="desk-field">
          <label className="desk-field__label" htmlFor="audit-entity">Registro</label>
          <select id="audit-entity" className="desk-input" value={filters.entityType} onChange={(event) => onChange({ entityType: event.target.value as AuditFilters['entityType'] })}>
            <option value="">Todos los registros</option>
            {AUDIT_ENTITY_TYPES.map((type) => <option key={type} value={type}>{entityTypeLabel(type)}</option>)}
          </select>
        </div>

        <div className="desk-field">
          <label className="desk-field__label" htmlFor="audit-action">Acción</label>
          <select id="audit-action" className="desk-input" value={filters.action} onChange={(event) => onChange({ action: event.target.value as AuditFilters['action'] })}>
            <option value="">Todas las acciones</option>
            {AUDIT_ACTIONS.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}
          </select>
        </div>

        <div className="desk-field">
          <label className="desk-field__label" htmlFor="audit-from">Desde</label>
          <input id="audit-from" className="desk-input" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => onChange({ from: event.target.value })} />
        </div>

        <div className="desk-field">
          <label className="desk-field__label" htmlFor="audit-to">Hasta</label>
          <input id="audit-to" className="desk-input" type="date" value={filters.to} min={filters.from || undefined} onChange={(event) => onChange({ to: event.target.value })} />
        </div>
      </div>

      <div className="audit-filters__actions">
        <div className="audit-ranges" role="group" aria-label="Rangos rápidos">
          {QUICK_RANGES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className="audit-range"
              aria-pressed={activeRange === id}
              onClick={() => onChange(quickRange(id as QuickRange))}
            >
              {label}
            </button>
          ))}
        </div>
        <button type="button" className="button button--secondary" onClick={onClear} disabled={!hasActiveFilters(filters)}>
          Limpiar filtros
        </button>
      </div>

      {chips.length > 0 && (
        <ul className="audit-chips" aria-label="Filtros aplicados">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button type="button" className="audit-chip" aria-label={`Quitar filtro ${chip.label}`} onClick={() => onChange({ [chip.key]: '' })}>
                <span>{chip.label}</span>
                <span className="audit-chip__x" aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
