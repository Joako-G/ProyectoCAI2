import { useState } from 'react';
import './app.css';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { useSession } from './features/auth/hooks/useSession';
import type { AuthUser } from './features/auth/types/auth';
import { DisciplinesView } from './features/disciplines/components/DisciplinesView';
import { MembersView } from './features/members/components/MembersView';
import { UsersView } from './features/users/components/UsersView';
import { AppShell } from './layouts/AppShell';
import type { Section } from './layouts/Sidebar';

// No router: the visible section is plain state.
const PAGES: Record<Section, { title: string; subtitle: string }> = {
  members: { title: 'Socios', subtitle: 'Búsqueda por N° de socio, DNI o nombre' },
  disciplines: { title: 'Disciplinas', subtitle: 'Catálogo de disciplinas y sus profesores' },
  users: { title: 'Usuarios', subtitle: 'Administración de cuentas de demostración' },
};

export function App() {
  const { user, restoring, signIn, signOut } = useSession();
  const [view, setView] = useState<Section>('members');

  function handleLogin(signedIn: AuthUser) {
    signIn(signedIn); setView('members');
  }

  async function handleLogout() {
    await signOut(); setView('members');
  }

  if (restoring) return null;
  if (!user) return <LoginScreen onLogin={handleLogin} />;

  const { title, subtitle } = PAGES[view];
  return <AppShell title={title} subtitle={subtitle} section={view} onNavigate={setView} user={user} onLogout={handleLogout}>
    {view === 'members' ? <MembersView /> : view === 'disciplines' ? <DisciplinesView /> : <UsersView currentUserId={user.id} />}
  </AppShell>;
}
