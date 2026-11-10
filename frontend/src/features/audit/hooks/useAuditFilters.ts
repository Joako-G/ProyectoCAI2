import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { AuditFilters } from '../types/audit';
import { applyFilterChange, EMPTY_FILTERS, filtersFromParams, filtersToParams } from '../utils/audit-filters';

/**
 * The filters of the audit screen, kept in the URL query string so a filtered view survives a reload and can be shared.
 * Changes replace the history entry: a filter is a refinement of one view, not a page to go back through.
 */
export function useAuditFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);

  const change = useCallback(
    (patch: Partial<AuditFilters>) => {
      // The updater form reads the latest URL, so two quick changes in a row never overwrite each other.
      setParams((previous) => filtersToParams(applyFilterChange(filtersFromParams(previous), patch)), { replace: true });
    },
    [setParams],
  );

  const clear = useCallback(() => setParams(filtersToParams(EMPTY_FILTERS), { replace: true }), [setParams]);

  return { filters, change, clear };
}
