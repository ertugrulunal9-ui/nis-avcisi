import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { claimRunDir, makeRunId, purgeOutputs } from '../src/temizlik.mjs';

const GUN = 86400000;
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

function mk(outDir, name, ageDays, { meta = true } = {}) {
  const d = path.join(outDir, name);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, 'rapor.md'), 'x');
  const t = NOW - ageDays * GUN;
  if (meta) fs.writeFileSync(path.join(d, 'meta.json'), JSON.stringify({ createdAt: new Date(t).toISOString() }));
  else fs.utimesSync(d, new Date(t), new Date(t));
  return d;
}

test('meta.json createdAt: 31 gün silinir, 29 gün kalır', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-out-'));
  const eski = mk(out, 'eski', 31);
  const taze = mk(out, 'taze', 29);
  assert.equal(purgeOutputs(out, NOW, 30), 1);
  assert.equal(fs.existsSync(eski), false);
  assert.equal(fs.existsSync(taze), true);
});

test('meta yoksa klasör mtime kullanılır', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-out-'));
  const eski = mk(out, 'eski', 40, { meta: false });
  const taze = mk(out, 'taze', 5, { meta: false });
  assert.equal(purgeOutputs(out, NOW, 30), 1);
  assert.equal(fs.existsSync(eski), false);
  assert.equal(fs.existsSync(taze), true);
});

test('out/ yoksa 0; dosyalara dokunulmaz', () => {
  assert.equal(purgeOutputs(path.join(os.tmpdir(), 'nis-yok-' + Date.now()), NOW, 30), 0);
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-out-'));
  fs.writeFileSync(path.join(out, 'not.txt'), 'x');
  assert.equal(purgeOutputs(out, NOW, 30), 0);
  assert.equal(fs.existsSync(path.join(out, 'not.txt')), true);
});

test('makeRunId İstanbul saatiyle YYYY-MM-DD-HHmm', () => {
  // 2026-11-18 21:05 UTC = 00:05 İstanbul (UTC+3), ertesi gün
  assert.equal(makeRunId(Date.UTC(2026, 10, 18, 21, 5)), '2026-11-19-0005');
  assert.equal(makeRunId(Date.UTC(2026, 10, 18, 9, 30)), '2026-11-18-1230');
});

test('claimRunDir çakışmada -2, -3 ekler', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-out-'));
  const a = claimRunDir(out, '2026-11-18-1230');
  const b = claimRunDir(out, '2026-11-18-1230');
  const c = claimRunDir(out, '2026-11-18-1230');
  assert.deepEqual([a.runId, b.runId, c.runId], ['2026-11-18-1230', '2026-11-18-1230-2', '2026-11-18-1230-3']);
  assert.ok(fs.existsSync(c.dir));
});
