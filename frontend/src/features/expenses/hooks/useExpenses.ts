import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../members/services/members-api';
import { createExpense, fetchExpenses } from '../services/expenses-api';
import type { Expense, ExpenseInput } from '../types/expense';
import { describeLoadError, describeSaveError } from '../utils/expense-format';

const SAVED_BUT_NOT_LISTED = 'El gasto sí quedó guardado; reintente para ver la lista actualizada.';

export type ExpensesState = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; expenses: Expense[] };
export type SaveState = { phase: 'idle' } | { phase: 'saving' } | { phase: 'error'; message: string };

/** Loads the expenses and records a new one, reloading the list after a save whose outcome is unknown. */
export function useExpenses() {
  const [state, setState] = useState<ExpensesState>({ phase: 'loading' });
  const [saving, setSaving] = useState<SaveState>({ phase: 'idle' });
  const controller = useRef<AbortController | null>(null);

  // After a save that worked, a failed read must not look like a failed save.
  const load = useCallback(async (afterSave = false) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    try {
      const expenses = await fetchExpenses(current.signal);
      if (!current.signal.aborted) setState({ phase: 'ready', expenses });
    } catch (error: unknown) {
      if (!current.signal.aborted) setState({ phase: 'error', message: afterSave ? SAVED_BUT_NOT_LISTED : describeLoadError(error) });
    }
  }, []);

  useEffect(() => {
    void load();
    return () => controller.current?.abort();
  }, [load]);

  const reload = useCallback(() => {
    setState({ phase: 'loading' });
    void load();
  }, [load]);

  /** Resolves true when the expense was saved, so the form knows to clear itself. */
  const save = useCallback(async (input: ExpenseInput): Promise<boolean> => {
    setSaving({ phase: 'saving' });
    try {
      await createExpense(input);
      setSaving({ phase: 'idle' });
      await load(true);
      return true;
    } catch (error: unknown) {
      setSaving({ phase: 'error', message: describeSaveError(error) });
      // A failure whose outcome is unknown (network, 5xx) may still have stored the expense.
      if (!(error instanceof ApiError) || error.status >= 500) await load();
      return false;
    }
  }, [load]);

  return { state, saving, reload, save };
}
