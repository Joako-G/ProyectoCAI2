import { MembersView } from './features/members/components/MembersView';
import { AppShell } from './layouts/AppShell';

export function App() {
  return (
    <AppShell
      title="Socios"
      subtitle="Búsqueda por N° de socio, DNI o nombre"
    >
      <MembersView />
    </AppShell>
  );
}
