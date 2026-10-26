import { useState } from 'react';
import { describePricingError } from '../utils/pricing-format';

/** Runs one write at a time for a section and keeps its saving flag, Spanish error and success notice. */
export function useSaveAction() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    setSaving(true);
    setError(undefined);
    setNotice(undefined);
    try {
      await action();
      setNotice(success);
      return true;
    } catch (caught) {
      setError(describePricingError(caught));
      return false;
    } finally {
      setSaving(false);
    }
  }

  /** For a client-side validation failure: show it like a server error and drop any old notice. */
  function fail(message: string) {
    setNotice(undefined);
    setError(message);
  }

  return { saving, error, notice, run, fail };
}

export type SaveAction = ReturnType<typeof useSaveAction>;
