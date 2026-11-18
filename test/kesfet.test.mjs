import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runDiscover } from '../src/kesfet.mjs';
import { createFakeFetch, prepareRoot } from './helpers/fake-fetch.mjs';

const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);

test('keşif: tohum x dil x ek istekleri, tekrarlar ve tohum çıkar, anahtar yok', async () => {
  const root = prepareRoot(fs.mkdtempSync(path.join(os.tmpdir(), 'nis-kesif-')), { derived: false });
  const s = JSON.parse(fs.readFileSync(path.join(root, 'config', 'ayarlar.json'), 'utf8'));
  const fake = createFakeFetch({ nowMs: NOW });
  const sleeps = [];
  const { outPath } = await runDiscover({
    seeds: ['osmanlı tarihi'], langs: ['tr', 'en'], nowMs: NOW, rootDir: root,
    fetchImpl: fake, sleep: async (ms) => { sleeps.push(ms); }, log: () => {}
  });
  const istek = s.kesif.ekler.tr.length + s.kesif.ekler.en.length;
  assert.equal(fake.calls['/complete/search'], istek);
  assert.equal(sleeps.length, istek - 1);
  assert.ok(sleeps.every((ms) => ms === s.kesif.beklemeMs));
  assert.ok(fake.requests.every((r) => r.headers['x-goog-api-key'] === undefined && !r.url.includes('key=')));

  assert.ok(outPath.endsWith('-kesif'));
  for (const f of ['kesif.md', 'kesif.json', 'meta.json']) assert.ok(fs.existsSync(path.join(outPath, f)), f);
  const data = JSON.parse(fs.readFileSync(path.join(outPath, 'kesif.json'), 'utf8'));
  const tr = data.results.find((r) => r.lang === 'tr');
  assert.ok(tr.oneriler.length > 0);
  assert.ok(!tr.oneriler.includes('osmanlı tarihi'));
  assert.equal(new Set(tr.oneriler.map((x) => x.toLowerCase())).size, tr.oneriler.length);
  assert.ok(tr.oneriler.some((x) => x.includes('şu ğ ı')));
  assert.ok(fs.readFileSync(path.join(outPath, 'kesif.md'), 'utf8').includes('osmanlı tarihi (tr)'));
});

test('keşif: bir istek hata verirse diğerleri sürer', async () => {
  const root = prepareRoot(fs.mkdtempSync(path.join(os.tmpdir(), 'nis-kesif-')), { derived: false });
  const fake = createFakeFetch({ nowMs: NOW, errors: { suggest: { status: 500, times: 1 } } });
  const { outPath } = await runDiscover({
    seeds: ['uzay'], langs: ['en'], nowMs: NOW, rootDir: root, fetchImpl: fake, sleep: async () => {}, log: () => {}
  });
  const data = JSON.parse(fs.readFileSync(path.join(outPath, 'kesif.json'), 'utf8'));
  assert.ok(data.results[0].oneriler.length > 0);
});
