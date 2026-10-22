import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';
import { Sidebar, type Section } from './Sidebar';

interface AppShellProps {
  title: string;
  subtitle?: string;
  /** Section highlighted in the sidebar. */
  section?: Section;
  onNavigate?: (section: Section) => void;
  children?: ReactNode;
}

export function AppShell({ title, subtitle, section, onNavigate, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar current={section} onNavigate={onNavigate} />
      <div className="app-shell__column">
        <PageHeader title={title} subtitle={subtitle} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
