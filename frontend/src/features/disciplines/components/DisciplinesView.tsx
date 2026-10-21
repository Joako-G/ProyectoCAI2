import { useState } from 'react';
import type { Discipline, DisciplineListQuery } from '../types/discipline';
import { DisciplineFormScreen } from './DisciplineFormScreen';
import { DisciplinesPage } from './DisciplinesPage';

// No router: the visible screen is plain state, like the members feature.
type View = { name: 'list' } | { name: 'create' } | { name: 'edit'; discipline: Discipline };

/** Container of the disciplines feature: switches between the list and the create / edit form. */
export function DisciplinesView() {
  const [view, setView] = useState<View>({ name: 'list' });
  // Kept here, not in the list, so the filters survive going to the form and back.
  const [query, setQuery] = useState<DisciplineListQuery>({ search: '', status: 'all' });
  const showList = () => setView({ name: 'list' });

  if (view.name === 'list') {
    return (
      <DisciplinesPage
        query={query}
        onQueryChange={setQuery}
        onCreate={() => setView({ name: 'create' })}
        onEdit={(discipline) => setView({ name: 'edit', discipline })}
      />
    );
  }

  return (
    <DisciplineFormScreen
      discipline={view.name === 'edit' ? view.discipline : null}
      onSaved={showList}
      onCancel={showList}
    />
  );
}
