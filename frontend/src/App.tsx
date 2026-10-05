import { MembersPage } from './features/members/components/MembersPage';
import { AppShell } from './layouts/AppShell';

export function App() {
  return (
    <AppShell
      title="Socios"
      subtitle="Búsqueda por N° de socio, DNI o nombre"
    >
      <MembersPage />
    </AppShell>
  );
}
