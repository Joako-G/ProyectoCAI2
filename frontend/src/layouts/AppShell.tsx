import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';
import type { AuthUser } from '../features/auth/types/auth';
import { Sidebar, type Section } from './Sidebar';

interface AppShellProps {
  title: string;
  subtitle?: string;
  /** Section highlighted in the sidebar. */
  section?: Section;
  onNavigate?: (section: Section) => void;
  user?: AuthUser;
  onLogout?: () => void;
  children?: ReactNode;
}

export function AppShell({ title, subtitle, section, onNavigate, user, onLogout, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar current={section} onNavigate={onNavigate} user={user} onLogout={onLogout} />
      <div className="app-shell__column">
        <PageHeader title={title} subtitle={subtitle} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
