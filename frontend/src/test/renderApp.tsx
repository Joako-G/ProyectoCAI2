import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { App } from '../App';

/** Shows the router's current path so tests can assert on the URL. */
function LocationProbe() {
  return <output aria-label="Ruta actual">{useLocation().pathname}</output>;
}

/** Renders the whole app inside an in-memory router, starting at the given URL. */
export function renderApp(initialPath = '/') {
  return render(<MemoryRouter initialEntries={[initialPath]}><App /><LocationProbe /></MemoryRouter>);
}
