import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { AuditView } from '../components/AuditView';

function LocationProbe() {
  // A span, not an <output>: output has the status role and would confuse the screen's own status queries.
  return <span data-testid="location-search">{useLocation().search}</span>;
}

/** Renders the audit screen at a URL; the probe shows the query string so tests can follow the URL state. */
export function renderAuditView(url = '/auditoria') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <AuditView />
      <LocationProbe />
    </MemoryRouter>,
  );
}
