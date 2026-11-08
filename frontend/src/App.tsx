import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router';
import './app.css';
import { LoginScreen } from './features/auth/components/LoginScreen';
import { useSession } from './features/auth/hooks/useSession';
import type { AuthUser } from './features/auth/types/auth';
import { can } from './features/auth/utils/can';
import { AccessPage } from './features/access/components/AccessPage';
import { EntranceDisplay } from './features/access/components/EntranceDisplay';
import { AuditView } from './features/audit/components/AuditView';
import { BackupView } from './features/backup/components/BackupView';
import { ArqueoView } from './features/cashcount/components/ArqueoView';
import { DisciplinesView } from './features/disciplines/components/DisciplinesView';
import { EnrollmentScreen } from './features/enrollment/components/EnrollmentScreen';
import { NoticesView } from './features/notices/components/NoticesView';
import { PaymentsView } from './features/payments/components/PaymentsView';
import { PricingView } from './features/pricing/components/PricingView';
import { ReportsView } from './features/reports/components/ReportsView';
import { RosterView } from './features/roster/components/RosterView';
import { MembersView } from './features/members/components/MembersView';
import { UsersView } from './features/users/components/UsersView';
import { AppShell } from './layouts/AppShell';
import { Forbidden, NoSections, NotFound } from './layouts/RouteMessages';
import { SECTIONS, sectionsFor, type Section } from './layouts/sections';

/** The screen of each section; built only for routes whose capability was already checked. */
function pageFor(section: Section, user: AuthUser) {
  switch (section) {
    case 'members': return <MembersView
      canWrite={can(user, 'members:write')}
      canManageFaces={can(user, 'faces:manage')}
      renderCreate={can(user, 'payments:collect') ? (props) => <EnrollmentScreen {...props} /> : undefined}
    />;
    case 'disciplines': return <DisciplinesView canWrite={can(user, 'disciplines:write')} />;
    case 'payments': return <PaymentsView canCollect={can(user, 'payments:collect')} canAnnul={can(user, 'payments:annul')} />;
    case 'notices': return <NoticesView />;
    case 'access': return <AccessPage />;
    case 'cashcount': return <ArqueoView />;
    case 'reports': return <ReportsView issuedBy={user.name} canReadCashCount={can(user, 'cashcount:run')} />;
    case 'roster': return <RosterView />;
    case 'pricing': return <PricingView canWrite={can(user, 'config:manage')} />;
    case 'audit': return <AuditView />;
    case 'backup': return <BackupView />;
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

/** The public entrance display lives outside the shell: full screen, no sidebar, but still behind login. */
const DISPLAY_PATH = '/pantalla-ingreso';

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
  const landing = requested === DISPLAY_PATH && allowed.includes('access')
    ? DISPLAY_PATH
    : SECTIONS.find(({ id, path }) => path === requested && allowed.includes(id))?.path ?? home;

  return <Routes>
    <Route path={DISPLAY_PATH} element={allowed.includes('access') ? <EntranceDisplay /> : <main><Forbidden homePath={home} /></main>} />
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
