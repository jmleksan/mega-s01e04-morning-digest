import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

function appWith(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return createApp({ adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir });
}

const line = (job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at: '2026-10-28T23:00:00+01:00', job, status, owner });

describe('digest routes', () => {
  it('page and JSON list the same jobs in the same order', async () => {
    const app = appWith({ '2026-10-28.jsonl': [line('b/job', 'ok'), line('a/job', 'fail', null)].join('\n') + '\n' });
    const page = await app.request('/digest/2026-10-28');
    const json = await app.request('/api/digest/2026-10-28');
    expect(page.status).toBe(200);
    expect(json.status).toBe(200);
    const jobs = ((await json.json()) as { rows: { job: string }[] }).rows.map((r) => r.job);
    expect(jobs).toEqual(['a/job', 'b/job']);
    const html = await page.text();
    expect(html.indexOf('a/job')).toBeLessThan(html.indexOf('b/job'));
    expect(html).toContain('—');
  });

  it('404s a night with no file', async () => {
    const app = appWith({});
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('renders an empty night as "nothing ran"', async () => {
    const app = appWith({ '2026-10-27.jsonl': '' });
    const res = await app.request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('survives a bad line and says so', async () => {
    const app = appWith({ '2026-10-28.jsonl': `${line('a/job', 'ok')}\n{"at":"trunc\n` });
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('1 unreadable line skipped');
    const json = (await (await app.request('/api/digest/2026-10-28')).json()) as { badLines: number };
    expect(json.badLines).toBe(1);
  });

  it('marks retries of 3 or more', async () => {
    const app = appWith({ '2026-10-28.jsonl': ['retry', 'retry', 'retry', 'ok'].map((s) => line('a/job', s)).join('\n') });
    expect(await (await app.request('/digest/2026-10-28')).text()).toContain('3 ⚠');
  });

  it('status board links each night with counts', async () => {
    const app = appWith({ '2026-10-28.jsonl': [line('a/job', 'retry'), line('a/job', 'ok')].join('\n') });
    const html = await (await app.request('/')).text();
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('ok 1 · retry 1 · fail 0');
  });
});
