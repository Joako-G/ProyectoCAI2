import type { SaveAction } from '../hooks/useSaveAction';

/** Presentational: the error (alert) or success (status) of the last write of a section. */
export function SaveFeedback({ error, notice }: Pick<SaveAction, 'error' | 'notice'>) {
  if (error) return <p className="form-alert" role="alert">{error}</p>;
  if (notice) return <p className="pricing-notice" role="status">{notice}</p>;
  return null;
}
