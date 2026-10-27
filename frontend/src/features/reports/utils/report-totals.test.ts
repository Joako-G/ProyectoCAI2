import { describe, expect, it } from 'vitest';
import { buildRevenue } from '../test/fixtures';
import { revenueMismatches } from './report-totals';

describe('revenueMismatches', () => {
  it('is empty when the three tables add up to the total', () => {
    expect(revenueMismatches(buildRevenue())).toEqual([]);
  });

  it('names each table whose rows do not add up to the total', () => {
    const report = buildRevenue({ byMethod: [{ method: 'cash', total: 4000 }], total: 4500 });

    expect(revenueMismatches(report)).toEqual(['Por medio de pago']);
  });
});
