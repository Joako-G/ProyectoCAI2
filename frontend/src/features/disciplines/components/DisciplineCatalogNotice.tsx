import type { DisciplineCatalog } from '../hooks/useDisciplineCatalog';

/** Warns that discipline names cannot be resolved and offers a retry; renders nothing otherwise. */
export function DisciplineCatalogNotice({ catalog }: { catalog: DisciplineCatalog }) {
  if (catalog.state.phase !== 'error') return null;

  return (
    <div className="members-page__notice members-page__notice--error" role="alert">
      <p>
        <strong>No se pudieron cargar las disciplinas.</strong> {catalog.state.message} Se muestran los
        identificadores en su lugar.
      </p>
      <button type="button" className="button button--secondary" onClick={catalog.retry}>
        Reintentar
      </button>
    </div>
  );
}
