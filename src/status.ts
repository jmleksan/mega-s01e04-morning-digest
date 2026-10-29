import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  counts: Record<string, { ok: number; retry: number; fail: number }>;
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Per night: how many log lines were ok / retry / fail, summed over jobs.
function nightCounts(runsDir: string, night: string) {
  const counts = { ok: 0, retry: 0, fail: 0 };
  const data = readNight(runsDir, night);
  for (const r of data?.rows ?? []) {
    counts.retry += r.retries;
    counts.fail += r.lastStatus === 'fail' ? 1 : 0;
    counts.ok += r.runs - r.retries - (r.lastStatus === 'fail' ? 1 : 0);
  }
  return counts;
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    counts: Object.fromEntries(nights.map((n) => [n, nightCounts(config.runsDir, n)])),
  };
}
