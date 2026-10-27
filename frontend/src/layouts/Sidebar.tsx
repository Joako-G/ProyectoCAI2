import { Link } from 'react-router';
import { SessionPanel } from '../features/auth/components/SessionPanel';
import type { AuthUser } from '../features/auth/types/auth';

import { NAVIGATION, SECTIONS, navigationFor, type NavLayoutEntry, type Section } from './sections';

export type { Section };

interface SidebarProps {
  /** Sections to list, in order; omitted lists every section. */
  sections?: ReadonlyArray<Section>;
  /** Section highlighted as the current page; none when the URL names no section. */
  current?: Section;
  /** How the sections are grouped; omitted lists them as plain links. */
  layout?: ReadonlyArray<NavLayoutEntry>;
  /** Signed-in account shown at the foot of the sidebar; omitted renders no session panel. */
  user?: AuthUser;
  onLogout?: () => void;
}

export function Sidebar({ sections, current, layout = NAVIGATION, user, onLogout }: SidebarProps) {
  const entries = navigationFor(sections ?? SECTIONS.map(({ id }) => id), layout);
  let position = 0;
  const renderLink = (id: Section) => {
    const section = SECTIONS.find((candidate) => candidate.id === id)!;
    position += 1;
    return (
      <Link
        key={id}
        className="sidebar__link"
        to={section.path}
        aria-current={id === current ? 'page' : undefined}
      >
        <span className="sidebar__link-index" aria-hidden="true">
          {String(position).padStart(2, '0')}
        </span>
        {section.label}
      </Link>
    );
  };
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-name">Club Independiente</div>
        <div className="sidebar__brand-tagline">Sistema de gestión</div>
      </div>
      <nav className="sidebar__nav" aria-label="Navegación principal">
        {entries.map((entry) =>
          entry.kind === 'link' ? (
            renderLink(entry.section)
          ) : (
            <div key={entry.id} className="sidebar__group" role="group" aria-label={entry.label}>
              <span className="sidebar__group-label" aria-hidden="true">{entry.label}</span>
              {entry.items.map(renderLink)}
            </div>
          ),
        )}
      </nav>
      {user && onLogout && <SessionPanel user={user} onLogout={onLogout} />}
    </aside>
  );
}
