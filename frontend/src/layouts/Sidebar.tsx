import { SessionPanel } from '../features/auth/components/SessionPanel';
import type { AuthUser } from '../features/auth/types/auth';

import { SECTIONS, type Section } from './sections';

export type { Section };

interface SidebarProps {
  /** Sections to list, in order; omitted lists every section. */
  sections?: ReadonlyArray<Section>;
  current?: Section;
  onNavigate?: (section: Section) => void;
  /** Signed-in account shown at the foot of the sidebar; omitted renders no session panel. */
  user?: AuthUser;
  onLogout?: () => void;
}

export function Sidebar({ sections, current = 'members', onNavigate, user, onLogout }: SidebarProps) {
  const visible = sections ? SECTIONS.filter(({ id }) => sections.includes(id)) : SECTIONS;
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-name">Club Independiente</div>
        <div className="sidebar__brand-tagline">Sistema de gestión</div>
      </div>
      <nav className="sidebar__nav" aria-label="Navegación principal">
        {visible.map((section, index) => (
          <a
            key={section.id}
            className="sidebar__link"
            href={`#${section.id}`}
            aria-current={section.id === current ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              onNavigate?.(section.id);
            }}
          >
            <span className="sidebar__link-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            {section.label}
          </a>
        ))}
      </nav>
      {user && onLogout && <SessionPanel user={user} onLogout={onLogout} />}
    </aside>
  );
}
