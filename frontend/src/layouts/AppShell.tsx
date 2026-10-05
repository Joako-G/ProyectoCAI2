import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  activeSection?: 'members' | 'users';
  onSectionChange?: (section: 'members' | 'users') => void;
}

export function AppShell({ title, subtitle, children, activeSection = 'members', onSectionChange = () => undefined }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar activeSection={activeSection} onSectionChange={onSectionChange} />
      <div className="app-shell__column">
        <PageHeader title={title} subtitle={subtitle} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
