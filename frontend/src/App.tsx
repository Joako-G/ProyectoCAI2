import { useState } from 'react';
import './app.css';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { useSession } from './features/auth/hooks/useSession';
import type { AuthUser } from './features/auth/types/auth';
import { can } from './features/auth/utils/can';
import { DisciplinesView } from './features/disciplines/components/DisciplinesView';
import { PricingView } from './features/pricing/components/PricingView';
import { RosterView } from './features/roster/components/RosterView';
import { MembersView } from './features/members/components/MembersView';
import { UsersView } from './features/users/components/UsersView';
import { AppShell } from './layouts/AppShell';
import { sectionsFor, type Section } from './layouts/sections';

// No router: the visible section is plain state.
const PAGES: Record<Section, { title: string; subtitle: string }> = {
  members: { title: 'Socios', subtitle: 'Búsqueda por N° de socio, DNI o nombre' },
  disciplines: { title: 'Disciplinas', subtitle: 'Catálogo de disciplinas y sus profesores' },
  users: { title: 'Usuarios', subtitle: 'Administración de cuentas de demostración' },
  roster: { title: 'Mis disciplinas', subtitle: 'Alumnos actuales y anteriores de sus disciplinas' },
  pricing: { title: 'Precios', subtitle: 'Tarifas, recargos por pago tardío y prorrateo' },
};

export function App() {
  const { user, restoring, signIn, signOut } = useSession();
  // The section the user picked; ignored when it is not (or no longer) allowed.
  const [requested, setRequested] = useState<Section>();

  function handleLogin(signedIn: AuthUser) {
    signIn(signedIn); setRequested(undefined);
  }

  async function handleLogout() {
    await signOut(); setRequested(undefined);
  }

  if (restoring) return null;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const sections = sectionsFor(user);
  const view = requested && sections.includes(requested) ? requested : sections[0];
  const shellProps = { sections, onNavigate: setRequested, user, onLogout: handleLogout };

  if (!view) {
    return <AppShell title="Club Independiente" {...shellProps}>
      <section className="card no-sections" aria-label="Sin secciones disponibles">
        <p className="no-sections__notice">Tu rol todavía no tiene secciones disponibles.</p>
      </section>
    </AppShell>;
  }

  const { title, subtitle } = PAGES[view];
  return <AppShell title={title} subtitle={subtitle} section={view} {...shellProps}>
    {view === 'members' ? <MembersView canWrite={can(user, 'members:write')} />
      : view === 'disciplines' ? <DisciplinesView canWrite={can(user, 'disciplines:write')} />
        : view === 'roster' ? <RosterView />
          : view === 'pricing' ? <PricingView canWrite={can(user, 'config:manage')} />
            : <UsersView currentUserId={user.id} />}
  </AppShell>;
}
