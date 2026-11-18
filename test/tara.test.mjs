import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runScan } from '../src/tara.mjs';
import { createFakeFetch, prepareRoot } from './helpers/fake-fetch.mjs';

const KEY = 'SAHTE-TEST-ANAHTARI-987';
const NOW = Date.UTC(2026, 10, 18, 12, 0, 0);
const NISLER = ['tarih-belgesel', 'osmanli'];

function mkRoot(opts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-tara-'));
  return prepareRoot(dir, opts);
}

async function scan(rootDir, { errors, fake, ...over } = {}) {
  const f = fake ?? createFakeFetch({ nowMs: NOW, errors });
  const sleeps = [];
  const logs = [];
  const result = await runScan({
    nicheIds: NISLER, langs: ['tr', 'en'], formats: ['uzun', 'kisa'], days: 180, nowMs: NOW,
    rootDir, apiKey: KEY, fetchImpl: f, sleep: async (ms) => { sleeps.push(ms); }, log: (m) => logs.push(m),
    ...over
  });
  return { result, fake: f, sleeps, logs };
}

const readReport = (outPath) => JSON.parse(fs.readFileSync(path.join(outPath, 'rapor.json'), 'utf8'));
const allCells = (rep) => rep.niches.flatMap((n) => n.cells);

test('türetilmiş mod: rapor yazılır, fırsat kanalı >= 2 ve puan dolu', async () => {
  const root = mkRoot({ derived: true });
  const { result, fake, logs } = await scan(root);
  assert.equal(result.exitCode, 0);
  assert.match(result.runId, /^2026-11-18-\d{4}$/);
  assert.equal(result.outPath, path.join(root, 'out', result.runId));
  for (const f of ['rapor.md', 'rapor.json', 'meta.json']) assert.ok(fs.existsSync(path.join(result.outPath, f)), f);
  assert.equal(JSON.parse(fs.readFileSync(path.join(result.outPath, 'meta.json'), 'utf8')).createdAt, new Date(NOW).toISOString());

  const rep = readReport(result.outPath);
  assert.equal(rep.derivedMetrics, true);
  assert.equal(rep.runId, result.runId);
  assert.equal(rep.quota.stoppedEarly, false);
  assert.equal(rep.quota.stopReason, null);
  assert.equal(rep.quota.searchLimit, 95);
  assert.equal(rep.quota.unitsLimit, 9000);
  assert.deepEqual(rep.params, { langs: ['tr', 'en'], formats: ['uzun', 'kisa'], days: 180 });
  assert.equal(rep.niches.length, 2);
  const cells = allCells(rep);
  assert.equal(cells.length, 8);
  assert.ok(cells.every((c) => c.error === null), JSON.stringify(cells.map((c) => c.error)));
  const guclu = cells.filter((c) => c.metrics.firsatKanallari.length >= 2 && c.score !== null);
  assert.ok(guclu.length >= 1);
  assert.ok(cells.every((c) => c.rows.every((r) => r.m !== null)));
  assert.ok(cells.some((c) => c.rpmBand && c.aylikTahmin));

  // arama: 2 niş x 2 dil x 2 ifade = 8; videos/channels: grup başına 1 (50 kimlik altı)
  assert.equal(fake.calls['/youtube/v3/search'], 8);
  const nVideos = fake.calls['/youtube/v3/videos'];
  const nChannels = fake.calls['/youtube/v3/channels'];
  assert.ok(nVideos >= 4 && nChannels >= 4); // 50'lik partiler
  assert.ok(logs.some((l) => l.includes('rapor.md')));

  // kota dosyası geçici kökte
  const kota = JSON.parse(fs.readFileSync(path.join(root, 'data', 'kota.json'), 'utf8'));
  assert.equal(kota.searchUsed, 8);
  assert.equal(kota.unitsUsed, nVideos + nChannels);
});

test('anahtar hiçbir çıktıda ve logda yok; kapak/öneri istekleri anahtarsız', async () => {
  const root = mkRoot({ derived: true });
  const { result, fake, logs } = await scan(root);
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else files.push(p);
    }
  })(root);
  for (const f of files) {
    if (f.endsWith('.jpg')) continue;
    assert.ok(!fs.readFileSync(f, 'utf8').includes(KEY), f);
  }
  assert.ok(!logs.join('\n').includes(KEY));
  const api = fake.requests.filter((r) => r.url.includes('googleapis.com'));
  assert.ok(api.length > 0);
  assert.ok(api.every((r) => r.headers['x-goog-api-key'] === KEY && !r.url.includes(KEY)));
  const thumbs = fake.requests.filter((r) => r.url.includes('i.ytimg.com'));
  assert.ok(thumbs.length > 0);
  assert.ok(thumbs.every((r) => r.headers['x-goog-api-key'] === undefined));
  assert.ok(result.outPath);
});

test('türetilmiş mod: kapaklar indirilir (en çok 12, jpg)', async () => {
  const root = mkRoot({ derived: true });
  const { result } = await scan(root);
  const dir = path.join(result.outPath, 'kapaklar');
  const jpgs = fs.readdirSync(dir);
  assert.ok(jpgs.length >= 1 && jpgs.length <= 12);
  assert.ok(jpgs.every((f) => f.endsWith('.jpg')));
  assert.ok(fs.statSync(path.join(dir, jpgs[0])).size > 0);
});

test('kapak indirme hatası raporu bozmaz', async () => {
  const root = mkRoot({ derived: true });
  const { result, logs } = await scan(root, { errors: { thumbnail: { status: 404 } } });
  assert.equal(result.exitCode, 0);
  assert.ok(fs.existsSync(path.join(result.outPath, 'rapor.md')));
  assert.ok(logs.some((l) => l.includes('Kapak indirilemedi')));
});

test('ham mod: puan yok, kapak yok, satırlarda m null', async () => {
  const root = mkRoot({ derived: false });
  const { result } = await scan(root);
  assert.equal(result.exitCode, 0);
  assert.equal(fs.existsSync(path.join(result.outPath, 'kapaklar')), false);
  const rep = readReport(result.outPath);
  assert.equal(rep.derivedMetrics, false);
  const cells = allCells(rep);
  assert.ok(cells.some((c) => c.rows.length > 0));
  for (const c of cells) {
    assert.equal(c.metrics, null);
    assert.equal(c.score, null);
    assert.equal(c.rpmBand, null);
    assert.equal(c.aylikTahmin, null);
    assert.ok(c.rows.every((r) => r.m === null));
  }
});

test('canlı/yaklaşan ve yanlış dildeki video elenir; kanal başına sınır', async () => {
  const root = mkRoot({ derived: true });
  const { result } = await scan(root);
  const rep = readReport(result.outPath);
  for (const n of rep.niches) {
    for (const lang of ['tr', 'en']) {
      const group = n.cells.filter((c) => c.lang === lang);
      const rows = group.flatMap((c) => c.rows);
      assert.ok(rows.length > 0);
      for (const r of rows) {
        assert.ok(!/canli|yaklasan|yanlis-dil/.test(r.video.id), r.video.id);
        assert.equal(r.video.liveBroadcastContent, 'none');
        assert.ok(r.video.language === null || r.video.language === lang);
      }
      const perChannel = new Map();
      for (const r of rows) perChannel.set(r.video.channelId, (perChannel.get(r.video.channelId) ?? 0) + 1);
      assert.ok([...perChannel.values()].every((v) => v <= 3));
      // 9. kanalda 5 uzun video var; yalnız en çok izlenen 3'ü kalır
      assert.equal(perChannel.get(`UCSahte${lang}09`), 3);
    }
  }
  // süresi 181..239 sn olan video hiçbir formata girmez
  const tum = allCells(rep).flatMap((c) => c.rows.map((r) => r.video));
  assert.ok(tum.every((v) => v.durationSec !== null && (v.durationSec >= 240 || v.durationSec <= 180)));
  // kanalı dönmeyen satır channel: null; gizli aboneli kanal subscriberCount: null
  assert.ok(tum.length > 0);
  const rows = allCells(rep).flatMap((c) => c.rows);
  assert.ok(rows.some((r) => r.channel === null));
  assert.ok(rows.some((r) => r.channel && r.channel.subscriberCount === null));
});

test('yerel arama payı 3: erken durur, rapor yazılır, kalan hücreler kota', async () => {
  const root = mkRoot({ derived: true, ayarlar: (s) => { s.kota.aramaPayi = 3; } });
  const { result, fake } = await scan(root);
  assert.equal(result.exitCode, 0);
  assert.equal(fake.calls['/youtube/v3/search'], 3);
  const rep = readReport(result.outPath);
  assert.equal(rep.quota.stoppedEarly, true);
  assert.equal(rep.quota.stopReason, 'yerel');
  assert.equal(rep.quota.searchUsed, 3);
  assert.equal(rep.quota.searchLimit, 3);
  const [n1, n2] = rep.niches;
  const tr = n1.cells.filter((c) => c.lang === 'tr');
  assert.ok(tr.every((c) => c.error === null && c.rows.length > 0));
  const kalan = [...n1.cells.filter((c) => c.lang === 'en'), ...n2.cells];
  assert.equal(kalan.length, 6);
  for (const c of kalan) {
    assert.equal(c.error, 'kota');
    assert.deepEqual(c.rows, []);
    assert.equal(c.score, null);
    assert.ok(c.queries.length >= 1);
  }
  assert.ok(fs.existsSync(path.join(result.outPath, 'rapor.md')));
  assert.equal(result.quota.searchLeft, 0);
});

test('Google quotaExceeded: stopReason google, sayaç doldu, rapor yazılır, çıkış 0', async () => {
  const root = mkRoot({ derived: true });
  const { result } = await scan(root, { errors: { search: { status: 403, reason: 'quotaExceeded' } } });
  assert.equal(result.exitCode, 0);
  const rep = readReport(result.outPath);
  assert.equal(rep.quota.stoppedEarly, true);
  assert.equal(rep.quota.stopReason, 'google');
  assert.ok(allCells(rep).every((c) => c.error === 'kota'));
  assert.equal(result.quota.searchLeft, 0);
});

test('ApiKeyError: çıkış 2, rapor ve çıktı klasörü yok', async () => {
  const root = mkRoot({ derived: true });
  const { result, logs } = await scan(root, { errors: { search: { status: 400, reason: 'keyInvalid' } } });
  assert.equal(result.exitCode, 2);
  assert.equal(result.outPath, null);
  assert.equal(fs.existsSync(path.join(root, 'out')), false);
  assert.ok(logs.some((l) => l.includes('anahtar')));
  assert.ok(!logs.join('\n').includes(KEY));
});

test('bir ifade hata verirse diğeri sürer; ağ yeniden denemesi sleep ile', async () => {
  const root = mkRoot({ derived: true });
  const { result, sleeps } = await scan(root, {
    nicheIds: ['tarih-belgesel'], langs: ['tr'], errors: { search: { status: 500, times: 3 } }
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(sleeps, [1000, 3000]);
  const rep = readReport(result.outPath);
  const cells = allCells(rep);
  assert.equal(cells.length, 2);
  assert.ok(cells.every((c) => c.error === null && c.rows.length > 0));
});

test('tüm ifadeler hata verirse hücreler hata mesajını taşır, tarama sürer', async () => {
  const root = mkRoot({ derived: true });
  const { result } = await scan(root, {
    nicheIds: ['tarih-belgesel'], langs: ['tr'], errors: { search: { status: 400, reason: 'invalidParameter' } }
  });
  assert.equal(result.exitCode, 0);
  const cells = allCells(readReport(result.outPath));
  assert.ok(cells.every((c) => typeof c.error === 'string' && c.error !== 'kota' && c.rows.length === 0));
  assert.equal(readReport(result.outPath).quota.stoppedEarly, false);
});

test('aynı dakikada ikinci koşu -2 ekini alır; tek format ve dil kısıtı uygulanır', async () => {
  const root = mkRoot({ derived: true });
  const a = await scan(root, { nicheIds: ['uzay'], langs: ['en'], formats: ['kisa'] });
  const b = await scan(root, { nicheIds: ['uzay'], langs: ['en'], formats: ['kisa'] });
  assert.equal(b.result.runId, `${a.result.runId}-2`);
  const cells = allCells(readReport(a.result.outPath));
  assert.deepEqual(cells.map((c) => `${c.lang}/${c.format}`), ['en/kisa']);
});

test('bilinmeyen niş kimliği hata fırlatır', async () => {
  const root = mkRoot({ derived: true });
  await assert.rejects(() => scan(root, { nicheIds: ['yok-boyle'] }), /yok-boyle/);
});
