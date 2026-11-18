import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../src/report.mjs';

const s = {
  uzunMinSaniye: 240,
  kisaMaxSaniye: 180,
  kanalBasinaMaxVideo: 3,
  esik: {
    tr: { kucukKanalAbone: 10000, yeniKanalGun: 365, buyukKanalAbone: 500000, oran: 3, aboneTabani: 1000, minIzlenme: 10000, referansGunlukIzlenme: 2000 },
    en: { kucukKanalAbone: 25000, yeniKanalGun: 365, buyukKanalAbone: 1000000, oran: 3, aboneTabani: 1000, minIzlenme: 30000, referansGunlukIzlenme: 10000 },
  },
  kisaCarpani: { minIzlenme: 5, referansGunlukIzlenme: 5 },
  agirlik: { firsat: 0.4, talep: 0.3, acik: 0.15, para: 0.15 },
  firsatMinKanal: 2,
  minOrnek: 10,
};

const YONTEM = '## Yöntem ve etiketler';

function mkRow(id, title, views, subs, derived) {
  return {
    video: {
      id,
      title,
      channelId: 'ch' + id,
      channelTitle: 'Kanal ' + id,
      publishedAt: '2026-10-01T10:00:00Z',
      durationSec: 600,
      viewCount: views,
      thumbnailUrl: null,
      language: 'tr',
      liveBroadcastContent: 'none',
    },
    channel: { id: 'ch' + id, title: 'Kanal ' + id, publishedAt: '2026-02-03T00:00:00Z', subscriberCount: subs, videoCount: 4 },
    m: derived ? { ageDays: 48, viewsPerDay: views / 48, oran: views / 1000, channelAgeDays: 288, smallOrNew: true } : null,
  };
}

function mkScore(puan, extra = {}) {
  return { puan, parcalar: { firsat: 50, talep: 70, acik: 80, para: 20 }, uyarilar: [], siralamaDisi: false, ...extra };
}

function mkMetrics(n = 12) {
  return {
    n,
    kanalSayisi: 8,
    medianViews: 20000,
    medianViewsPerDay: 1234.5,
    firsatKanallari: [
      { channelId: 'cha', channelTitle: 'Küçük | Kanal', subscriberCount: 1200, channelAgeDays: 90, videoId: 'vid1', title: 'Başlık | ile boru', viewCount: 123456, oran: 102.88 },
      { channelId: 'chb', channelTitle: 'Gizli Kanal', subscriberCount: null, channelAgeDays: 40, videoId: 'vid2', title: 'İkinci', viewCount: 50000, oran: 12 },
    ],
    buyukKanalPayi: 0.25,
    gizliAboneOrani: 0.1,
  };
}

function derivedRun(over = {}) {
  return {
    runId: '2026-11-18-1500',
    createdAt: '2026-11-18T12:00:00.000Z',
    finishedAt: '2026-11-18T12:05:00.000Z',
    derivedMetrics: true,
    quota: { day: '2026-11-18', searchUsed: 8, unitsUsed: 120, searchLimit: 95, unitsLimit: 9000, stoppedEarly: false, stopReason: null },
    params: { langs: ['tr', 'en'], formats: ['uzun', 'kisa'], days: 180 },
    niches: [
      {
        id: 'tarih', etiket: 'Tarih', kategori: 'tarih',
        cells: [
          { lang: 'tr', format: 'uzun', queries: ['tarih belgesel'], rows: [mkRow('1', 'A', 100, 10, true)], metrics: mkMetrics(), score: mkScore(77), rpmBand: [0.25, 0.8], aylikTahmin: [9.25, 29.6], error: null },
          { lang: 'tr', format: 'kisa', queries: ['tarih'], rows: [], metrics: null, score: null, rpmBand: null, aylikTahmin: null, error: 'uygun video yok' },
          { lang: 'en', format: 'uzun', queries: ['history'], rows: [mkRow('2', 'B', 100, 10, true)], metrics: mkMetrics(4), score: mkScore(10, { siralamaDisi: true, uyarilar: ['yetersiz örnek (n=4)'] }), rpmBand: [3, 6], aylikTahmin: [111.11, 222.22], error: null },
        ],
      },
      {
        id: 'finans', etiket: 'Finans', kategori: 'finans',
        cells: [
          { lang: 'tr', format: 'uzun', queries: ['borsa'], rows: [mkRow('3', 'C', 100, 10, true)], metrics: mkMetrics(), score: mkScore(90, { uyarilar: ['RPM bandı yok'] }), rpmBand: null, aylikTahmin: null, error: null },
          { lang: 'tr', format: 'kisa', queries: ['borsa'], rows: [], metrics: null, score: null, rpmBand: null, aylikTahmin: null, error: 'kota' },
        ],
      },
    ],
    ...over,
  };
}

function rawRun(over = {}) {
  const rows = Array.from({ length: 20 }, (_, i) => mkRow(String(i), 'Video | ' + i, 1000 * (i + 1), i === 10 ? null : 5000 + i, false));
  rows.push({ ...mkRow('x', 'Kanalsız', 777, 1, false), channel: null });
  return {
    runId: '2026-11-18-1600',
    createdAt: '2026-11-18T13:00:00.000Z',
    finishedAt: '2026-11-18T13:05:00.000Z',
    derivedMetrics: false,
    quota: { day: '2026-11-18', searchUsed: 3, unitsUsed: 10, searchLimit: 95, unitsLimit: 9000, stoppedEarly: false, stopReason: null },
    params: { langs: ['tr'], formats: ['uzun'], days: 180 },
    niches: [
      {
        id: 'tarih', etiket: 'Tarih', kategori: 'tarih',
        cells: [
          { lang: 'tr', format: 'uzun', queries: ['tarih belgesel'], rows, metrics: null, score: null, rpmBand: null, aylikTahmin: null, error: null },
          { lang: 'tr', format: 'kisa', queries: ['tarih'], rows: [], metrics: null, score: null, rpmBand: null, aylikTahmin: null, error: 'kota' },
        ],
      },
    ],
    ...over,
  };
}

function bolum1ile5(md) {
  const i = md.indexOf(YONTEM);
  assert.ok(i > 0, 'yöntem bölümü var');
  return md.slice(0, i);
}

test('ham mod: bölüm 1-5\'te puan/oran/medyan yok; json\'da m/metrics/score null', () => {
  const run = rawRun();
  const { markdown, json } = buildReport(run, s);
  const ust = bolum1ile5(markdown).toLowerCase();
  for (const kelime of ['puan', 'oran', 'medyan']) {
    assert.ok(!ust.includes(kelime), `"${kelime}" ham modda bölüm 1-5'te geçmemeli`);
  }
  assert.ok(markdown.includes('Mod: ham'));
  assert.ok(markdown.includes('## Ham veri'));
  for (const b of ['## Karşılaştırma', '## Sıralama', '## Fırsat kanalları']) assert.ok(!markdown.includes(b), b);
  for (const n of json.niches) {
    for (const c of n.cells) {
      assert.equal(c.metrics, null);
      assert.equal(c.score, null);
      for (const r of c.rows) assert.equal(r.m, null);
    }
  }
  // yöntem bölümünde neden + başvuru adresi
  const yontem = markdown.slice(markdown.indexOf(YONTEM));
  assert.ok(yontem.includes('https://support.google.com/youtube/contact/yt_api_form'));
  assert.ok(yontem.includes('Section 5'));
});

test('ham mod: ilk 15 satır, izlenmeye göre azalan, gizli abone, tarih ve link', () => {
  const { markdown } = buildReport(rawRun(), s);
  const bolum = markdown.slice(markdown.indexOf('## Ham veri'), markdown.indexOf(YONTEM));
  const satirlar = bolum.split('\n').filter((l) => l.includes('youtube.com/watch'));
  assert.equal(satirlar.length, 15);
  assert.ok(satirlar[0].includes('20.000')); // en yüksek 20000
  assert.ok(satirlar[0].includes('2026-10-01'));
  assert.ok(satirlar[0].includes('2026-02-03'));
  assert.ok(satirlar[0].includes('https://www.youtube.com/watch?v=19'));
  // 16. ve sonrası (en düşük) yok
  assert.ok(!bolum.includes('watch?v=x'));
  // abonesi gizli satır (i=10 -> 11000 izlenme) ilk 15'te
  assert.ok(bolum.includes('gizli'));
  // başlıkta | kaçırılmış, tablo sütun sayısı sabit
  assert.ok(bolum.includes('Video \\| 19'));
  const tabloSatirlari = satirlar.map((l) => l.replace(/\\\|/g, '').split('|').length);
  assert.ok(tabloSatirlari.every((n) => n === tabloSatirlari[0]));
  // boş hücre
  assert.ok(bolum.includes('Veri yok (kota)'));
});

test('ham mod: kanalsız satır gizli/—; 1000lik ayraç noktalı', () => {
  const run = rawRun();
  run.niches[0].cells[0].rows = [{ ...mkRow('z', 'Tek', 1234567, 1, false), channel: null }];
  const { markdown } = buildReport(run, s);
  assert.ok(markdown.includes('1.234.567'));
  const satir = markdown.split('\n').find((l) => l.includes('watch?v=z'));
  assert.ok(satir.includes('gizli'));
  assert.ok(satir.includes('—'));
});

test('ham mod: yöntem bölümünde etiket cümleleri ve neden', () => {
  const { markdown } = buildReport(rawRun(), s);
  const yontem = markdown.slice(markdown.indexOf(YONTEM));
  assert.ok(yontem.includes('Oran, medyan, günlük izlenme, puan ve gelir tahmini bu aracın hesabıdır, YouTube verisi değildir.'));
  assert.ok(yontem.includes('Gelir tahmini üçüncü taraf RPM tahminidir (config/rpm.json), YouTube verisi değildir.'));
  assert.ok(yontem.includes('Kısa = ≤ 180 sn video; dikey Shorts olduğu doğrulanamaz.'));
  assert.ok(yontem.includes('Puan yalnız aynı dil ve formattaki nişleri sıralar.'));
  assert.ok(yontem.includes('Neden puan yok'));
});

test('türetilmiş mod: bölüm başlıkları ve etiket cümleleri', () => {
  const { markdown } = buildReport(derivedRun(), s);
  for (const b of ['## Karşılaştırma (mutlak sayılar)', '## Sıralama', '## Fırsat kanalları', YONTEM]) {
    assert.ok(markdown.includes(b), b);
  }
  assert.ok(!markdown.includes('## Ham veri'));
  assert.ok(markdown.includes('Mod: türetilmiş'));
  assert.ok(markdown.includes('Oran, medyan, günlük izlenme, puan ve gelir tahmini bu aracın hesabıdır, YouTube verisi değildir.'));
  assert.ok(markdown.includes('Gelir tahmini üçüncü taraf RPM tahminidir (config/rpm.json), YouTube verisi değildir.'));
  assert.ok(markdown.includes('Kısa = ≤ 180 sn video; dikey Shorts olduğu doğrulanamaz.'));
  assert.ok(markdown.includes('Puan yalnız aynı dil ve formattaki nişleri sıralar.'));
  assert.ok(!markdown.includes('Neden puan yok'));
});

test('türetilmiş mod: başlıkta kota, hatalı hücre sayısı', () => {
  const { markdown } = buildReport(derivedRun(), s);
  assert.ok(markdown.includes('2026-11-18-1500'));
  assert.ok(markdown.includes('arama 8/95'));
  assert.ok(markdown.includes('birim 120/9000'));
  assert.ok(markdown.includes('Hatalı hücre sayısı: 2 / 5'));
  assert.ok(!markdown.includes('Erken durdu'));
});

test('erken durma nedeni başlıkta', () => {
  for (const [neden, beklenen] of [['yerel', 'yerel'], ['google', 'google']]) {
    const run = derivedRun();
    run.quota = { ...run.quota, stoppedEarly: true, stopReason: neden };
    const { markdown } = buildReport(run, s);
    const baslik = markdown.slice(0, markdown.indexOf('## '));
    assert.ok(baslik.includes('Erken durdu'));
    assert.ok(baslik.includes(beklenen));
  }
  // ham modda da
  const run = rawRun();
  run.quota = { ...run.quota, stoppedEarly: true, stopReason: 'google' };
  const { markdown } = buildReport(run, s);
  assert.ok(markdown.slice(0, markdown.indexOf('## ')).includes('Erken durdu'));
});

test('karşılaştırma: boş/hatalı hücre "—", sayılar Türkçe biçimli', () => {
  const { markdown } = buildReport(derivedRun(), s);
  const bolum = markdown.slice(markdown.indexOf('## Karşılaştırma'), markdown.indexOf('## Sıralama'));
  const tarih = bolum.split('\n').find((l) => l.startsWith('| Tarih | TR'));
  const cells = tarih.split('|').map((c) => c.trim()).filter((c) => c !== '');
  assert.equal(cells.length, 8);
  assert.equal(cells[2], '1.235'); // 1234,5 yuvarlanır
  assert.equal(cells[3], '2/8');
  assert.equal(cells[4], '$9,25 – $29,60');
  assert.deepEqual(cells.slice(5), ['—', '—', '—']); // kısa: uygun video yok
  // finans TR: aylık tahmin yok -> —, kısa hata (kota)
  const finans = bolum.split('\n').find((l) => l.startsWith('| Finans | TR'));
  const f = finans.split('|').map((c) => c.trim()).filter((c) => c !== '');
  assert.equal(f[4], '—');
  assert.deepEqual(f.slice(5), ['—', '—', '—']);
  // EN satırı ayrı (tarih en)
  assert.ok(bolum.includes('| Tarih | EN'));
  // her tablo satırında aynı sütun sayısı
  const satirlar = bolum.split('\n').filter((l) => l.startsWith('|'));
  assert.ok(satirlar.every((l) => l.split('|').length === satirlar[0].split('|').length));
});

test('sıralama: puana göre azalan, sıralama dışı ayrı liste, gruplar ayrı', () => {
  const { markdown } = buildReport(derivedRun(), s);
  const bolum = markdown.slice(markdown.indexOf('## Sıralama'), markdown.indexOf('## Fırsat kanalları'));
  assert.ok(bolum.includes('### TR · uzun'));
  assert.ok(bolum.includes('### EN · kısa'));
  const trUzun = bolum.slice(bolum.indexOf('### TR · uzun'), bolum.indexOf('### TR · kısa'));
  assert.ok(trUzun.indexOf('| Finans |') > 0);
  assert.ok(trUzun.indexOf('| Finans |') < trUzun.indexOf('| Tarih |'));
  assert.ok(trUzun.includes('50/70/80/20'));
  assert.ok(trUzun.includes('%25'));
  assert.ok(trUzun.includes('$0,25 – $0,80'));
  assert.ok(trUzun.includes('RPM bandı yok'));
  const enUzun = bolum.slice(bolum.indexOf('### EN · uzun'), bolum.indexOf('### EN · kısa'));
  assert.ok(enUzun.includes('Sıralama dışı (yetersiz örnek)'));
  assert.ok(enUzun.includes('- Tarih (n=4)'));
  assert.ok(!enUzun.includes('| Tarih |'));
});

test('fırsat kanalları: ilk 3 niş, link, gizli abone, | kaçırma', () => {
  const run = derivedRun();
  const { markdown } = buildReport(run, s);
  const bolum = markdown.slice(markdown.indexOf('## Fırsat kanalları'), markdown.indexOf(YONTEM));
  assert.ok(bolum.includes('https://www.youtube.com/watch?v=vid1'));
  assert.ok(bolum.includes('Küçük \\| Kanal'));
  assert.ok(bolum.includes('Başlık \\| ile boru'));
  assert.ok(bolum.includes('123.456'));
  assert.ok(bolum.includes('102,9×'));
  const gizli = bolum.split('\n').find((l) => l.includes('Gizli Kanal'));
  assert.ok(gizli.includes('gizli'));
  // sıralama dışı niş (EN uzun Tarih) fırsat bölümünde yer almaz
  const enUzun = bolum.slice(bolum.indexOf('### EN · uzun'), bolum.indexOf('### EN · kısa'));
  assert.ok(!enUzun.includes('vid1'));
  // sınır: 4 nişten yalnız ilk 3
  const bes = derivedRun();
  for (let i = 0; i < 4; i++) {
    bes.niches.push({
      id: 'x' + i, etiket: 'Ek' + i, kategori: 'tarih',
      cells: [{ lang: 'tr', format: 'uzun', queries: ['q'], rows: [], metrics: mkMetrics(), score: mkScore(50 - i), rpmBand: null, aylikTahmin: null, error: null }],
    });
  }
  const md = buildReport(bes, s).markdown;
  const b2 = md.slice(md.indexOf('## Fırsat kanalları'), md.indexOf(YONTEM));
  const trUzun = b2.slice(b2.indexOf('### TR · uzun'), b2.indexOf('### TR · kısa'));
  assert.equal((trUzun.match(/^#### /gm) ?? []).length, 3);
  assert.ok(trUzun.includes('#### Finans'));
  assert.ok(trUzun.includes('#### Tarih'));
  assert.ok(trUzun.includes('#### Ek0'));
  assert.ok(!trUzun.includes('#### Ek1'));
});

test('json: runData\'nın derin kopyası', () => {
  const run = derivedRun();
  const { json } = buildReport(run, s);
  assert.deepEqual(json, run);
  assert.notEqual(json, run);
  assert.notEqual(json.niches[0], run.niches[0]);
  json.niches[0].etiket = 'değişti';
  assert.equal(run.niches[0].etiket, 'Tarih');
});

test('boş niş listesi hata vermez', () => {
  const r1 = buildReport(derivedRun({ niches: [] }), s);
  assert.ok(r1.markdown.includes('Veri yok.'));
  const r2 = buildReport(rawRun({ niches: [] }), s);
  assert.ok(r2.markdown.includes('## Ham veri'));
});
