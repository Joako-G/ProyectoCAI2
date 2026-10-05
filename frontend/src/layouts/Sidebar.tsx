interface SidebarProps {
  activeSection: 'members' | 'users';
  onSectionChange: (section: 'members' | 'users') => void;
}

export function Sidebar({ activeSection, onSectionChange }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-name">Club Independiente</div>
        <div className="sidebar__brand-tagline">Sistema de gestión</div>
      </div>
      <nav className="sidebar__nav" aria-label="Navegación principal">
        <a className="sidebar__link" href="/" aria-current={activeSection === 'members' ? 'page' : undefined} onClick={event => { event.preventDefault(); onSectionChange('members'); }}>
          <span className="sidebar__link-index" aria-hidden="true">
            01
          </span>
          Socios
        </a>
        <a className="sidebar__link" href="/users" aria-current={activeSection === 'users' ? 'page' : undefined} onClick={event => { event.preventDefault(); onSectionChange('users'); }}>
          <span className="sidebar__link-index" aria-hidden="true">02</span>
          Usuarios
        </a>
      </nav>
    </aside>
  );
}
