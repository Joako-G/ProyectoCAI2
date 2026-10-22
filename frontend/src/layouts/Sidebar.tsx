export type Section = 'members' | 'disciplines' | 'users';

interface SidebarProps {
  current?: Section;
  onNavigate?: (section: Section) => void;
}

const SECTIONS: ReadonlyArray<{ id: Section; label: string }> = [
  { id: 'members', label: 'Socios' },
  { id: 'disciplines', label: 'Disciplinas' },
  { id: 'users', label: 'Usuarios' },
];

export function Sidebar({ current = 'members', onNavigate }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-name">Club Independiente</div>
        <div className="sidebar__brand-tagline">Sistema de gestión</div>
      </div>
      <nav className="sidebar__nav" aria-label="Navegación principal">
        {SECTIONS.map((section, index) => (
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
    </aside>
  );
}
