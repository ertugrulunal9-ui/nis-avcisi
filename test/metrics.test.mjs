import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  median,
  classifyFormat,
  isSmallOrNew,
  videoMetrics,
  minIzlenme,
  nicheMetrics,
  rpmLookup,
  maxRpmMid,
  aylikTahmin,
  nicheScore,
} from '../src/metrics.mjs';

const GUN = 86400000;
const NOW = Date.parse('2026-11-18T12:00:00Z');
const ago = (days) => new Date(NOW - days * GUN).toISOString();

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

const rpm = {
  uzun: { en: { finans: [8, 14], tarih: [3, 6] }, tr: { tarih: [0.25, 0.8], finans: [0.6, 1.6] } },
  kisa: { en: { '*': [0.03, 0.08] }, tr: { '*': [0.01, 0.03] } },
};

function mkRow({ id, channelId, views, subs, chAge = 100, vAge = 10, lang = 'tr' }) {
  const video = { id, title: 't' + id, channelId, channelTitle: 'K' + channelId, publishedAt: ago(vAge), durationSec: 600, viewCount: views };
  const channel = subs === undefined ? null : { id: channelId, title: 'K' + channelId, publishedAt: ago(chAge), subscriberCount: subs, videoCount: 5 };
  return { video, channel, m: videoMetrics(video, channel, lang, NOW, s) };
}

test('median: tek, çift, null/NaN, boş', () => {
  assert.equal(median([5]), 5);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null, 1, NaN, 3, undefined]), 2);
  assert.equal(median([]), null);
  assert.equal(median([null, NaN]), null);
});

test('classifyFormat sınırları', () => {
  assert.equal(classifyFormat(179, s), 'kisa');
  assert.equal(classifyFormat(180, s), 'kisa');
  assert.equal(classifyFormat(181, s), null);
  assert.equal(classifyFormat(239, s), null);
  assert.equal(classifyFormat(240, s), 'uzun');
  assert.equal(classifyFormat(1, s), 'kisa');
  assert.equal(classifyFormat(0, s), null);
  assert.equal(classifyFormat(null, s), null);
  assert.equal(classifyFormat(3600, s), 'uzun');
});

test('isSmallOrNew: null kanal, abone eşiği, yaş, gizli abone + yeni kanal', () => {
  assert.equal(isSmallOrNew(null, 'tr', NOW, s), false);
  assert.equal(isSmallOrNew({ subscriberCount: 10000, publishedAt: ago(2000) }, 'tr', NOW, s), true);
  assert.equal(isSmallOrNew({ subscriberCount: 10001, publishedAt: ago(2000) }, 'tr', NOW, s), false);
  assert.equal(isSmallOrNew({ subscriberCount: 10001, publishedAt: ago(365) }, 'tr', NOW, s), true);
  assert.equal(isSmallOrNew({ subscriberCount: 10001, publishedAt: ago(366) }, 'tr', NOW, s), false);
  // gizli abone (null) + yeni kanal -> true; gizli abone + eski kanal -> false
  assert.equal(isSmallOrNew({ subscriberCount: null, publishedAt: ago(30) }, 'tr', NOW, s), true);
  assert.equal(isSmallOrNew({ subscriberCount: null, publishedAt: ago(3000) }, 'tr', NOW, s), false);
  assert.equal(isSmallOrNew({ subscriberCount: null, publishedAt: null }, 'tr', NOW, s), false);
  // en eşiği tr'den farklı
  assert.equal(isSmallOrNew({ subscriberCount: 20000, publishedAt: ago(2000) }, 'en', NOW, s), true);
});

test('videoMetrics: günlük izlenme, oran tabanı, null kuralları', () => {
  const v = { publishedAt: ago(10), viewCount: 50000 };
  const ch = { subscriberCount: 5000, publishedAt: ago(100) };
  const m = videoMetrics(v, ch, 'tr', NOW, s);
  assert.equal(Math.round(m.ageDays), 10);
  assert.equal(Math.round(m.viewsPerDay), 5000);
  assert.equal(m.oran, 10);
  assert.equal(Math.round(m.channelAgeDays), 100);
  assert.equal(m.smallOrNew, true);

  // abone tabanı: 100 abone -> 1000 ile bölünür
  const m2 = videoMetrics(v, { subscriberCount: 100, publishedAt: ago(100) }, 'tr', NOW, s);
  assert.equal(m2.oran, 50);
  const m3 = videoMetrics(v, { subscriberCount: 0, publishedAt: ago(100) }, 'tr', NOW, s);
  assert.equal(m3.oran, 50);

  // ageDays en az 1
  const m4 = videoMetrics({ publishedAt: new Date(NOW - 1000).toISOString(), viewCount: 100 }, ch, 'tr', NOW, s);
  assert.equal(m4.ageDays, 1);
  assert.equal(m4.viewsPerDay, 100);

  // null durumlar
  const m5 = videoMetrics(v, { subscriberCount: null, publishedAt: ago(5000) }, 'tr', NOW, s);
  assert.equal(m5.oran, null);
  assert.equal(m5.smallOrNew, false);
  const m6 = videoMetrics({ publishedAt: ago(10), viewCount: null }, ch, 'tr', NOW, s);
  assert.equal(m6.viewsPerDay, null);
  assert.equal(m6.oran, null);
  const m7 = videoMetrics(v, null, 'tr', NOW, s);
  assert.equal(m7.oran, null);
  assert.equal(m7.channelAgeDays, null);
  assert.equal(m7.smallOrNew, false);
});

test('minIzlenme: dil ve format', () => {
  assert.equal(minIzlenme('tr', 'uzun', s), 10000);
  assert.equal(minIzlenme('tr', 'kisa', s), 50000);
  assert.equal(minIzlenme('en', 'uzun', s), 30000);
  assert.equal(minIzlenme('en', 'kisa', s), 150000);
});

test('nicheMetrics: fırsat kuralları (kanal başına tek, eşikler)', () => {
  const rows = [
    mkRow({ id: 'a1', channelId: 'A', views: 40000, subs: 2000 }), // oran 20
    mkRow({ id: 'a2', channelId: 'A', views: 90000, subs: 2000 }), // oran 45 -> A için en iyi
    mkRow({ id: 'b1', channelId: 'B', views: 12000, subs: 3000 }), // oran 4
    mkRow({ id: 'c1', channelId: 'C', views: 9000, subs: 500 }), // minIzlenme altı (oran 9)
    mkRow({ id: 'd1', channelId: 'D', views: 20000, subs: 9000 }), // oran 2.2 < 3
    mkRow({ id: 'e1', channelId: 'E', views: 900000, subs: 800000 }), // büyük, küçük değil
    mkRow({ id: 'f1', channelId: 'F', views: 50000, subs: 100000 }), // büyük değil ama küçük de değil
  ];
  const nm = nicheMetrics(rows, 'tr', 'uzun', s);
  assert.equal(nm.n, 7);
  assert.equal(nm.kanalSayisi, 6);
  assert.deepEqual(nm.firsatKanallari.map((k) => k.channelId), ['A', 'B']);
  assert.equal(nm.firsatKanallari[0].videoId, 'a2');
  assert.equal(nm.firsatKanallari[0].oran, 45);
  assert.equal(nm.firsatKanallari[0].subscriberCount, 2000);
  assert.equal(nm.firsatKanallari[0].viewCount, 90000);
  assert.equal(nm.firsatKanallari[0].channelTitle, 'KA');
  assert.equal(nm.firsatKanallari[0].title, 'ta2');
  assert.ok(Math.abs(nm.firsatKanallari[0].channelAgeDays - 100) < 1e-6);
  assert.equal(nm.medianViews, 40000);
  assert.ok(nm.medianViewsPerDay > 0);
});

test('nicheMetrics: kısa formatta minIzlenme çarpanı; yeni kanal fırsat sayılır', () => {
  const rows = [
    mkRow({ id: 'a', channelId: 'A', views: 49999, subs: 100 }), // 50000 altı
    mkRow({ id: 'b', channelId: 'B', views: 50000, subs: 100 }),
    mkRow({ id: 'c', channelId: 'C', views: 2000000, subs: 500000, chAge: 30 }), // yeni kanal, oran 4
  ];
  const nm = nicheMetrics(rows, 'tr', 'kisa', s);
  assert.deepEqual(nm.firsatKanallari.map((k) => k.channelId).sort(), ['B', 'C']);
  const nmUzun = nicheMetrics(rows, 'tr', 'uzun', s);
  assert.equal(nmUzun.firsatKanallari.length, 3);
});

test('nicheMetrics: buyukKanalPayi ve gizliAboneOrani, null paydalar', () => {
  const rows = [
    mkRow({ id: '1', channelId: 'A', views: 1000, subs: 600000 }),
    mkRow({ id: '2', channelId: 'B', views: 1000, subs: 100 }),
    mkRow({ id: '3', channelId: 'C', views: 1000, subs: null }),
    mkRow({ id: '4', channelId: 'D', views: 1000, subs: undefined }), // kanal null
  ];
  const nm = nicheMetrics(rows, 'tr', 'uzun', s);
  // abonesi bilinen: A, B -> 1/2
  assert.equal(nm.buyukKanalPayi, 0.5);
  // kanalı olan: A, B, C -> gizli 1/3
  assert.ok(Math.abs(nm.gizliAboneOrani - 1 / 3) < 1e-9);

  const hepsiKanalsiz = nicheMetrics([mkRow({ id: '5', channelId: 'X', views: 10, subs: undefined })], 'tr', 'uzun', s);
  assert.equal(hepsiKanalsiz.buyukKanalPayi, null);
  assert.equal(hepsiKanalsiz.gizliAboneOrani, null);

  const hepsiGizli = nicheMetrics([mkRow({ id: '6', channelId: 'X', views: 10, subs: null })], 'tr', 'uzun', s);
  assert.equal(hepsiGizli.buyukKanalPayi, null);
  assert.equal(hepsiGizli.gizliAboneOrani, 1);

  const bos = nicheMetrics([], 'tr', 'uzun', s);
  assert.equal(bos.n, 0);
  assert.equal(bos.medianViews, null);
  assert.equal(bos.medianViewsPerDay, null);
  assert.deepEqual(bos.firsatKanallari, []);
});

test('rpmLookup: uzun, kısa (*), eksik kategori, geçersiz format', () => {
  assert.deepEqual(rpmLookup(rpm, 'finans', 'en', 'uzun'), [8, 14]);
  assert.deepEqual(rpmLookup(rpm, 'tarih', 'tr', 'uzun'), [0.25, 0.8]);
  assert.deepEqual(rpmLookup(rpm, 'finans', 'en', 'kisa'), [0.03, 0.08]);
  assert.deepEqual(rpmLookup(rpm, 'herhangi', 'tr', 'kisa'), [0.01, 0.03]);
  assert.equal(rpmLookup(rpm, 'oyun', 'en', 'uzun'), null);
  assert.equal(rpmLookup(rpm, 'finans', 'de', 'uzun'), null);
  assert.equal(rpmLookup(rpm, '*', 'en', 'uzun'), null);
  assert.equal(rpmLookup(rpm, 'finans', 'en', 'not'), null);
  assert.equal(rpmLookup(rpm, 'finans', 'en', 'not'), null);
  assert.equal(rpmLookup(rpm, 'constructor', 'en', 'uzun'), null);
});

test('maxRpmMid', () => {
  assert.equal(maxRpmMid(rpm, 'en', 'uzun'), 11);
  assert.ok(Math.abs(maxRpmMid(rpm, 'tr', 'uzun') - 1.1) < 1e-9);
  assert.ok(Math.abs(maxRpmMid(rpm, 'en', 'kisa') - 0.055) < 1e-9);
  assert.equal(maxRpmMid(rpm, 'de', 'uzun'), null);
  assert.equal(maxRpmMid(rpm, 'en', 'x'), null);
});

test('aylikTahmin', () => {
  assert.deepEqual(aylikTahmin(1000, [2, 4]), [60, 120]);
  assert.deepEqual(aylikTahmin(333, [0.25, 0.8]), [2.5, 7.99]);
  assert.equal(aylikTahmin(null, [2, 4]), null);
  assert.equal(aylikTahmin(1000, null), null);
});

function mkMetrics(over = {}) {
  const fk = (i) => ({ channelId: 'c' + i, oran: 5 });
  return {
    n: 20,
    kanalSayisi: 10,
    medianViews: 1000,
    medianViewsPerDay: 2000,
    firsatKanallari: [fk(1), fk(2)],
    buyukKanalPayi: 0.2,
    gizliAboneOrani: 0.1,
    ...over,
  };
}

test('nicheScore: n=0 -> null', () => {
  assert.equal(nicheScore(nicheMetrics([], 'tr', 'uzun', s), [1, 2], 2, 'tr', 'uzun', s), null);
});

test('nicheScore: parçalar ve puan hesabı', () => {
  const sc = nicheScore(mkMetrics(), [8, 14], 11, 'en', 'uzun', s);
  // fırsat 50, talep 100*log10(2001)/log10(10001) ~ 82.6, açık 80, para 100
  assert.equal(sc.parcalar.firsat, 50);
  assert.equal(sc.parcalar.talep, Math.round((100 * Math.log10(2001)) / Math.log10(10001)));
  assert.equal(sc.parcalar.acik, 80);
  assert.equal(sc.parcalar.para, 100);
  const beklenen = Math.round(0.4 * 50 + 0.3 * ((100 * Math.log10(2001)) / Math.log10(10001)) + 0.15 * 80 + 0.15 * 100);
  assert.equal(sc.puan, beklenen);
  assert.deepEqual(sc.uyarilar, []);
  assert.equal(sc.siralamaDisi, false);
  assert.ok(Number.isInteger(sc.puan));
});

test('nicheScore: fırsat kanalı sayısına göre; firsatMinKanal altında 0; 4+ kanal 100', () => {
  const k = (n) => Array.from({ length: n }, (_, i) => ({ channelId: 'c' + i }));
  assert.equal(nicheScore(mkMetrics({ firsatKanallari: k(0) }), [1, 2], 2, 'tr', 'uzun', s).parcalar.firsat, 0);
  assert.equal(nicheScore(mkMetrics({ firsatKanallari: k(1) }), [1, 2], 2, 'tr', 'uzun', s).parcalar.firsat, 0);
  assert.equal(nicheScore(mkMetrics({ firsatKanallari: k(3) }), [1, 2], 2, 'tr', 'uzun', s).parcalar.firsat, 75);
  assert.equal(nicheScore(mkMetrics({ firsatKanallari: k(9) }), [1, 2], 2, 'tr', 'uzun', s).parcalar.firsat, 100);
});

test('nicheScore: talep tavanı/tabanı, kısa referansı', () => {
  assert.equal(nicheScore(mkMetrics({ medianViewsPerDay: 10 ** 9 }), [1, 2], 2, 'tr', 'uzun', s).parcalar.talep, 100);
  assert.equal(nicheScore(mkMetrics({ medianViewsPerDay: 0 }), [1, 2], 2, 'tr', 'uzun', s).parcalar.talep, 0);
  assert.equal(nicheScore(mkMetrics({ medianViewsPerDay: null }), [1, 2], 2, 'tr', 'uzun', s).parcalar.talep, 0);
  // kısa: ref = 2000*5 = 10000 -> 2000 günlük izlenme daha düşük talep
  const uzun = nicheScore(mkMetrics(), [1, 2], 2, 'tr', 'uzun', s).parcalar.talep;
  const kisa = nicheScore(mkMetrics(), [1, 2], 2, 'tr', 'kisa', s).parcalar.talep;
  assert.equal(uzun, 100);
  assert.ok(kisa < uzun);
  assert.equal(kisa, Math.round((100 * Math.log10(2001)) / Math.log10(10001)));
});

test('nicheScore: açıklık ve para sınırları', () => {
  assert.equal(nicheScore(mkMetrics({ buyukKanalPayi: null }), [1, 2], 2, 'tr', 'uzun', s).parcalar.acik, 50);
  assert.equal(nicheScore(mkMetrics({ buyukKanalPayi: 1 }), [1, 2], 2, 'tr', 'uzun', s).parcalar.acik, 0);
  assert.equal(nicheScore(mkMetrics({ buyukKanalPayi: 0 }), [1, 2], 2, 'tr', 'uzun', s).parcalar.acik, 100);
  assert.equal(nicheScore(mkMetrics(), null, 2, 'tr', 'uzun', s).parcalar.para, 0);
  assert.equal(nicheScore(mkMetrics(), [1, 2], null, 'tr', 'uzun', s).parcalar.para, 0);
  const orta = nicheScore(mkMetrics(), [1, 3], 4, 'tr', 'uzun', s).parcalar.para; // orta=2, max=4
  assert.equal(orta, Math.round((100 * Math.log(3)) / Math.log(5)));
});

test('nicheScore: puan 0..100 aralığında', () => {
  const en = nicheScore(
    mkMetrics({ firsatKanallari: Array.from({ length: 8 }, () => ({})), buyukKanalPayi: 0, medianViewsPerDay: 1e9 }),
    [8, 14], 11, 'en', 'uzun', s,
  );
  assert.equal(en.puan, 100);
  const dusuk = nicheScore(
    mkMetrics({ firsatKanallari: [], buyukKanalPayi: 1, medianViewsPerDay: 0, n: 50 }),
    null, null, 'en', 'uzun', s,
  );
  assert.equal(dusuk.puan, 0);
});

test('nicheScore: uyarı metinleri ve sırası, siralamaDisi', () => {
  const sc = nicheScore(
    mkMetrics({ n: 4, firsatKanallari: [{ channelId: 'x' }], gizliAboneOrani: 0.5, buyukKanalPayi: null }),
    null, null, 'tr', 'uzun', s,
  );
  assert.deepEqual(sc.uyarilar, [
    'yetersiz örnek (n=4)',
    'tek fırsat kanalı; şans olabilir',
    'kanalların çoğu abone sayısını gizliyor',
    'abone verisi yok',
    'RPM bandı yok',
  ]);
  assert.equal(sc.siralamaDisi, true);

  // gizliAboneOrani tam 0.3 -> uyarı yok; n tam minOrnek -> sıralamada
  const sc2 = nicheScore(mkMetrics({ n: 10, gizliAboneOrani: 0.3 }), [1, 2], 2, 'tr', 'uzun', s);
  assert.deepEqual(sc2.uyarilar, []);
  assert.equal(sc2.siralamaDisi, false);
});
