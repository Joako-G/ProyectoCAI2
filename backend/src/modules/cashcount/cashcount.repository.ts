import type { CashCount } from './cashcount.types.js';

export interface CashCountMutation<R> {
  cashCounts: CashCount[];
  result: R;
}

export interface CashCountRepository {
  // A missing file reads as no closes.
  list(): Promise<CashCount[]>;
  // Runs read-check-write as one unit; throwing inside `change` aborts without writing.
  mutate<R>(change: (cashCounts: CashCount[]) => CashCountMutation<R>): Promise<R>;
}
