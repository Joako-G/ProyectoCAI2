import { useState } from 'react';
import { catalogDisciplines, useDisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { todayInClub } from '../utils/member-format';
import { MemberDetailScreen } from './MemberDetailScreen';
import { MemberFormScreen } from './MemberFormScreen';
import { MembersPage } from './MembersPage';

interface MembersViewProps {
  /** Overrides today's club date (`YYYY-MM-DD`); used by tests. */
  today?: string;
}

// No router (the app has a single section): the visible screen is plain state.
type View =
  | { name: 'list' }
  | { name: 'detail'; id: string }
  | { name: 'create' }
  | { name: 'edit'; id: string };

/** Container of the members feature: switches between list, detail and the create / edit form. */
export function MembersView({ today = todayInClub() }: MembersViewProps) {
  const [view, setView] = useState<View>({ name: 'list' });
  const showList = () => setView({ name: 'list' });
  // Fetched once for the whole feature: the list, detail and form all resolve ids through it.
  const catalog = useDisciplineCatalog();
  const disciplines = catalogDisciplines(catalog);

  switch (view.name) {
    case 'list':
      return (
        <MembersPage
          today={today}
          disciplines={disciplines}
          onCreate={() => setView({ name: 'create' })}
          onOpen={(id) => setView({ name: 'detail', id })}
        />
      );
    case 'detail':
      return (
        <MemberDetailScreen
          id={view.id}
          today={today}
          disciplines={disciplines}
          onBack={showList}
          onEdit={(id) => setView({ name: 'edit', id })}
        />
      );
    case 'create':
      return (
        <MemberFormScreen
          memberId={null}
          today={today}
          catalog={catalog}
          onSaved={(member) => setView({ name: 'detail', id: member.id })}
          onCancel={showList}
        />
      );
    case 'edit':
      return (
        <MemberFormScreen
          memberId={view.id}
          today={today}
          catalog={catalog}
          onSaved={(member) => setView({ name: 'detail', id: member.id })}
          onCancel={() => setView({ name: 'detail', id: view.id })}
        />
      );
  }
}
