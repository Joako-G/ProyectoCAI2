import { useState } from 'react';
import type { Discipline } from '../types/discipline';
import { DisciplineFormScreen } from './DisciplineFormScreen';
import { DisciplinesPage } from './DisciplinesPage';

// No router: the visible screen is plain state, like the members feature.
type View = { name: 'list' } | { name: 'create' } | { name: 'edit'; discipline: Discipline };

/** Container of the disciplines feature: switches between the list and the create / edit form. */
export function DisciplinesView() {
  const [view, setView] = useState<View>({ name: 'list' });
  const showList = () => setView({ name: 'list' });

  if (view.name === 'list') {
    return (
      <DisciplinesPage
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
