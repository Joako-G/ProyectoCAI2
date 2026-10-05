import type { ReactNode } from 'react';
import { PageHeader } from './PageHeader';
import { Sidebar } from './Sidebar';

interface AppShellProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

export function AppShell({ title, subtitle, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-shell__column">
        <PageHeader title={title} subtitle={subtitle} />
        <main className="app-shell__content">{children}</main>
      </div>
    </div>
  );
}
