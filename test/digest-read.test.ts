import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  it('folds 2026-10-28 into 5 jobs and counts the bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(n?.badLines).toBe(1);
    const f = n?.rows.find((r) => r.job === 'fixtures/refresh');
    expect(f).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(n?.rows.find((r) => r.job === 'digest/render')?.owner).toBeNull();
    expect(n?.rows.find((r) => r.job === 'notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '1999-01-01')).toBeNull();
  });
});
