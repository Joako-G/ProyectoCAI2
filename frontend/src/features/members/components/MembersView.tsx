import { useState, type ReactNode } from 'react';
import { useDisciplineCatalog, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import type { Member, MemberListQuery } from '../types/member';
import { todayInClub } from '../utils/member-format';
import { MemberDetailScreen } from './MemberDetailScreen';
import { MemberFormScreen } from './MemberFormScreen';
import { MembersPage } from './MembersPage';

interface CreateScreenProps {
  today: string;
  catalog: DisciplineCatalog;
  onSaved: (member: Member) => void;
  onCancel: () => void;
}

interface MembersViewProps {
  /** Overrides today's club date (`YYYY-MM-DD`); used by tests. */
  today?: string;
  /** Whether the user may create, edit, deactivate and reactivate members. */
  canWrite: boolean;
  /** Replaces the plain create form, for example with the enrollment that also collects; the app composes it. */
  renderCreate?: (props: CreateScreenProps) => ReactNode;
}

// No router (the app has a single section): the visible screen is plain state.
type View =
  | { name: 'list' }
  | { name: 'detail'; id: string }
  | { name: 'create' }
  | { name: 'edit'; id: string };

/** Container of the members feature: switches between list, detail and the create / edit form. */
export function MembersView({ today = todayInClub(), canWrite, renderCreate }: MembersViewProps) {
  const [view, setView] = useState<View>({ name: 'list' });
  // Kept here, not in the list, so the filters survive going to the detail or form and back.
  const [query, setQuery] = useState<MemberListQuery>({ search: '', status: 'all', disciplineId: '' });
  const showList = () => setView({ name: 'list' });
  // Fetched once for the whole feature: the list, detail and form all resolve ids through it.
  const catalog = useDisciplineCatalog();

  switch (view.name) {
    case 'list':
      return (
        <MembersPage
          today={today}
          query={query}
          onQueryChange={setQuery}
          catalog={catalog}
          canCreate={canWrite}
          onCreate={() => setView({ name: 'create' })}
          onOpen={(id) => setView({ name: 'detail', id })}
        />
      );
    case 'detail':
      return (
        <MemberDetailScreen
          id={view.id}
          today={today}
          catalog={catalog}
          canWrite={canWrite}
          onBack={showList}
          onEdit={(id) => setView({ name: 'edit', id })}
        />
      );
    case 'create':
      if (renderCreate) {
        return renderCreate({ today, catalog, onSaved: (member) => setView({ name: 'detail', id: member.id }), onCancel: showList });
      }
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
