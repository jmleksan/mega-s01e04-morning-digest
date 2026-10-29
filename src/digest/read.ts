import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

const statuses: readonly string[] = ['ok', 'retry', 'fail'];

type Entry = { at: string; job: string; status: RunStatus; owner: string | null; error: string | null };

function parseLine(line: string): Entry | null {
  try {
    const o: unknown = JSON.parse(line);
    if (typeof o !== 'object' || o === null) return null;
    const r = o as Record<string, unknown>;
    if (typeof r.at !== 'string' || typeof r.job !== 'string') return null;
    if (typeof r.status !== 'string' || !statuses.includes(r.status)) return null;
    return {
      at: r.at,
      job: r.job,
      status: r.status as RunStatus,
      owner: typeof r.owner === 'string' ? r.owner : null,
      error: typeof r.error === 'string' ? r.error : null,
    };
  } catch {
    return null;
  }
}

export const readNight: ReadNight = (runsDir, night): Night | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const e = parseLine(line);
    if (!e) {
      badLines++;
      continue;
    }
    const row = byJob.get(e.job);
    if (!row) {
      byJob.set(e.job, {
        job: e.job,
        owner: e.owner,
        runs: 1,
        retries: e.status === 'retry' ? 1 : 0,
        lastStatus: e.status,
        lastError: e.error,
        firstAt: e.at,
        lastAt: e.at,
      });
      continue;
    }
    row.runs++;
    if (e.status === 'retry') row.retries++;
    row.lastStatus = e.status;
    row.lastError = e.error;
    row.lastAt = e.at;
    if (e.owner !== null) row.owner = e.owner;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
