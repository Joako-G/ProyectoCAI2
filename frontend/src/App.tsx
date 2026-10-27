import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import './app.css';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { useSession } from './features/auth/hooks/useSession';
import type { AuthUser } from './features/auth/types/auth';
import { can } from './features/auth/utils/can';
import { DisciplinesView } from './features/disciplines/components/DisciplinesView';
import { PaymentsView } from './features/payments/components/PaymentsView';
import { PricingView } from './features/pricing/components/PricingView';
import { RosterView } from './features/roster/components/RosterView';
import { MembersView } from './features/members/components/MembersView';
import { UsersView } from './features/users/components/UsersView';
import { AppShell } from './layouts/AppShell';
import { Forbidden, NoSections, NotFound } from './layouts/RouteMessages';
import { SECTIONS, sectionsFor, type Section } from './layouts/sections';

/** The screen of each section; built only for routes whose capability was already checked. */
function pageFor(section: Section, user: AuthUser) {
  switch (section) {
    case 'members': return <MembersView canWrite={can(user, 'members:write')} />;
    case 'disciplines': return <DisciplinesView canWrite={can(user, 'disciplines:write')} />;
    case 'payments': return <PaymentsView canCollect={can(user, 'payments:collect')} canAnnul={can(user, 'payments:annul')} />;
    case 'roster': return <RosterView />;
    case 'pricing': return <PricingView canWrite={can(user, 'config:manage')} />;
    case 'users': return <UsersView currentUserId={user.id} />;
  }
}

/** Shared shell: title and sidebar highlight follow the section the URL names. */
function ShellLayout({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { pathname } = useLocation();
  const allowed = sectionsFor(user);
  // A section the role cannot open is not highlighted nor named in the header.
  const current = SECTIONS.find(({ id, path }) => path === pathname && allowed.includes(id));
  return <AppShell
    title={current?.label ?? 'Club Independiente'} subtitle={current?.subtitle} section={current?.id}
    sections={allowed} user={user} onLogout={onLogout}
  >
    <Outlet />
  </AppShell>;
}

export function App() {
  const { user, restoring, signIn, signOut } = useSession();
  const navigate = useNavigate();
  const { pathname, state } = useLocation();

  async function handleLogout() {
    await signOut(); navigate('/login', { replace: true });
  }

  if (restoring) return null;

  if (!user) {
    // Remember where the visitor was heading so signing in brings them back there.
    const from = pathname === '/login' ? (state as { from?: string } | null)?.from : pathname;
    return <Routes>
      <Route path="/login" element={<LoginScreen onLogin={signIn} />} />
      <Route path="*" element={<Navigate to="/login" replace state={{ from }} />} />
    </Routes>;
  }

  const allowed = sectionsFor(user);
  const home = SECTIONS.find(({ id }) => id === allowed[0])?.path;
  const requested = (state as { from?: string } | null)?.from;
  const landing = SECTIONS.find(({ id, path }) => path === requested && allowed.includes(id))?.path ?? home;

  return <Routes>
    <Route element={<ShellLayout user={user} onLogout={() => void handleLogout()} />}>
      {SECTIONS.map(({ id, path }) => (
        <Route key={id} path={path} element={allowed.includes(id) ? pageFor(id, user) : <Forbidden homePath={home} />} />
      ))}
      <Route path="/" element={home ? <Navigate to={home} replace /> : <NoSections />} />
      <Route path="/login" element={landing ? <Navigate to={landing} replace /> : <NoSections />} />
      <Route path="*" element={<NotFound homePath={home} />} />
    </Route>
  </Routes>;
}
