import { useState } from 'react';
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
  const [open, setOpen] = useState(false);
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
    <aside
      className="sidebar"
      data-open={open}
      onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}
      onClick={(event) => { if ((event.target as HTMLElement).closest('a, .sidebar__logout')) setOpen(false); }}
    >
      <div className="sidebar__brand">
        <div className="sidebar__brand-name">Club Atlético Independiente</div>
        <div className="sidebar__brand-tagline">Sistema de gestión</div>
      </div>
      {/* Only shown on small screens, where the sections collapse behind it. */}
      <button
        type="button"
        className="sidebar__toggle"
        aria-expanded={open}
        aria-controls="sidebar-navigation"
        aria-label={open ? 'Cerrar el menú' : 'Abrir el menú'}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="sidebar__toggle-bars" aria-hidden="true" />
      </button>
      <nav id="sidebar-navigation" className="sidebar__nav" aria-label="Navegación principal">
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
