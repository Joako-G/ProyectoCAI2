export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-name">Club Independiente</div>
        <div className="sidebar__brand-tagline">Sistema de gestión</div>
      </div>
      <nav className="sidebar__nav" aria-label="Navegación principal">
        <a className="sidebar__link" href="/" aria-current="page">
          <span className="sidebar__link-index" aria-hidden="true">
            01
          </span>
          Socios
        </a>
      </nav>
    </aside>
  );
}
