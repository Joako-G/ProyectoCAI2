import { Link } from 'react-router';

interface RouteMessageProps {
  /** Where "Volver al inicio" leads; omitted when the user has no section to return to. */
  homePath?: string;
}

function RouteMessage({ title, text, homePath }: RouteMessageProps & { title: string; text: string }) {
  return <section className="card no-sections" aria-label={title}>
    <h2>{title}</h2>
    <p className="no-sections__notice">{text}</p>
    {homePath && <Link to={homePath}>Volver al inicio</Link>}
  </section>;
}

/** Shown when the URL names a section the signed-in role may not open. */
export function Forbidden({ homePath }: RouteMessageProps) {
  return <RouteMessage title="Sin acceso" text="Tu rol no tiene permiso para ver esta sección." homePath={homePath} />;
}

/** Shown when the URL matches no section. */
export function NotFound({ homePath }: RouteMessageProps) {
  return <RouteMessage title="Página no encontrada" text="La dirección que abriste no existe." homePath={homePath} />;
}

/** Shown to a signed-in role that has no section at all. */
export function NoSections() {
  return <section className="card no-sections" aria-label="Sin secciones disponibles">
    <p className="no-sections__notice">Tu rol todavía no tiene secciones disponibles.</p>
  </section>;
}
