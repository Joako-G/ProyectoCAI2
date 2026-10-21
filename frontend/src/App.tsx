import { useState } from 'react';
import { DisciplinesView } from './features/disciplines/components/DisciplinesView';
import { MembersView } from './features/members/components/MembersView';
import { AppShell } from './layouts/AppShell';
import type { Section } from './layouts/Sidebar';

// No router: the visible section is plain state.
const PAGES: Record<Section, { title: string; subtitle: string }> = {
  members: { title: 'Socios', subtitle: 'Búsqueda por N° de socio, DNI o nombre' },
  disciplines: { title: 'Disciplinas', subtitle: 'Catálogo de disciplinas y sus profesores' },
};

export function App() {
  const [section, setSection] = useState<Section>('members');
  const { title, subtitle } = PAGES[section];

  return (
    <AppShell title={title} subtitle={subtitle} section={section} onNavigate={setSection}>
      {section === 'members' ? <MembersView /> : <DisciplinesView />}
    </AppShell>
  );
}
