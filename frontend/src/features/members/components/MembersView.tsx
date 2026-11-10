import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDisciplineCatalog, type DisciplineCatalog } from '../../disciplines/hooks/useDisciplineCatalog';
import { useMembersSummary } from '../hooks/useMembersSummary';
import type { Member, MemberListQuery } from '../types/member';
import type { StandingGroup } from '../types/member-summary';
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

export interface MembersViewProps {
  /** Overrides today's club date (`YYYY-MM-DD`); used by tests. */
  today?: string;
  /** Whether the user may create, edit, deactivate and reactivate members. */
  canWrite: boolean;
  /** Whether the record shows the face recognition block (`faces:manage`). */
  canManageFaces?: boolean;
  /** Replaces the plain create form, for example with the enrollment that also collects; the app composes it. */
  renderCreate?: (props: CreateScreenProps) => ReactNode;
  /** A search applied when the screen opens, for example a member number sent from the entrance desk. */
  initialSearch?: string;
}

// No router (the app has a single section): the visible screen is plain state.
type View =
  | { name: 'list' }
  | { name: 'detail'; id: string }
  | { name: 'create' }
  | { name: 'edit'; id: string };

/** Container of the members feature: switches between list, detail and the create / edit form. */
export function MembersView({ today = todayInClub(), canWrite, canManageFaces = false, renderCreate, initialSearch = '' }: MembersViewProps) {
  const [view, setView] = useState<View>({ name: 'list' });
  // Kept here, not in the list, so the filters survive going to the detail or form and back.
  const [query, setQuery] = useState<MemberListQuery>({ search: initialSearch, status: 'all', disciplineId: '' });
  // Narrows the list to an account standing group, picked from the stat cards; kept with the query for the same reason.
  const [standing, setStanding] = useState<StandingGroup | null>(null);
  const showList = () => setView({ name: 'list' });
  // The counts live here, not in the list, so a change made in the detail or form is counted when the list comes back.
  const summary = useMembersSummary();
  const { refresh: refreshSummary } = summary;
  const previousView = useRef(view.name);
  useEffect(() => {
    if (view.name === 'list' && previousView.current !== 'list') refreshSummary();
    previousView.current = view.name;
  }, [view.name, refreshSummary]);
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
          summary={summary}
          standing={standing}
          onStandingChange={setStanding}
        />
      );
    case 'detail':
      return (
        <MemberDetailScreen
          id={view.id}
          today={today}
          catalog={catalog}
          canWrite={canWrite}
          canManageFaces={canManageFaces}
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
