import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createQuota, pacificDay } from '../src/quota.mjs';
import { QuotaExceededError } from '../src/errors.mjs';

const settings = { kota: { aramaPayi: 3, birimPayi: 5 } };
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nis-kota-')), 'data', 'kota.json');

test('pacificDay: kışın UTC 07:59 önceki gün, 08:00 yeni gün', () => {
  assert.equal(pacificDay(Date.UTC(2026, 0, 15, 7, 59)), '2026-01-14');
  assert.equal(pacificDay(Date.UTC(2026, 0, 15, 8, 0)), '2026-01-15');
});

test('pacificDay: yazın sınır UTC 07:00', () => {
  assert.equal(pacificDay(Date.UTC(2026, 6, 15, 6, 59)), '2026-07-14');
  assert.equal(pacificDay(Date.UTC(2026, 6, 15, 7, 0)), '2026-07-15');
});

test('pay aşımı QuotaExceededError(yerel) atar ve saymaz', () => {
  const q = createQuota({ path: tmp(), settings, nowFn: () => Date.UTC(2026, 0, 15, 12) });
  q.useSearch(2);
  q.useSearch(1);
  assert.throws(() => q.useSearch(1), (e) => e instanceof QuotaExceededError && e.source === 'yerel' && e.bucket === 'search');
  assert.equal(q.status().searchUsed, 3);
  assert.throws(() => q.useUnits(6), QuotaExceededError);
  assert.equal(q.status().unitsUsed, 0);
  q.useUnits(5);
  assert.equal(q.status().unitsLeft, 0);
});

test('markExhausted sayacı limite eşitler ve dosyaya yazar', () => {
  const p = tmp();
  const now = () => Date.UTC(2026, 0, 15, 12);
  const q = createQuota({ path: p, settings, nowFn: now });
  q.useSearch(1);
  q.markExhausted('search');
  assert.equal(q.status().searchUsed, 3);
  assert.throws(() => q.useSearch(1), QuotaExceededError);
  const disk = JSON.parse(fs.readFileSync(p, 'utf8'));
  assert.deepEqual(disk, { day: '2026-01-15', searchUsed: 3, unitsUsed: 0 });
  // yeni nesne aynı dosyayı okur
  assert.throws(() => createQuota({ path: p, settings, nowFn: now }).useSearch(1), QuotaExceededError);
});

test('Pasifik gün dönümünde sayaç sıfırlanır', () => {
  const p = tmp();
  let t = Date.UTC(2026, 0, 15, 7, 59);
  const q = createQuota({ path: p, settings, nowFn: () => t });
  q.useSearch(3);
  assert.throws(() => q.useSearch(1), QuotaExceededError);
  t = Date.UTC(2026, 0, 15, 8, 0);
  q.useSearch(1);
  const st = q.status();
  assert.equal(st.day, '2026-01-15');
  assert.equal(st.searchUsed, 1);
  assert.equal(st.searchLimit, 3);
  assert.equal(st.unitsLimit, 5);
  assert.equal(st.searchLeft, 2);
});

test('bozuk ya da eksik dosya sıfırdan başlar; status yazmaz', () => {
  const p = tmp();
  const q = createQuota({ path: p, settings, nowFn: () => Date.UTC(2026, 0, 15, 12) });
  assert.equal(q.status().searchUsed, 0);
  assert.equal(fs.existsSync(p), false);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, '{bozuk');
  assert.equal(q.status().searchUsed, 0);
});
