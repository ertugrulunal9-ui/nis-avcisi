// Saf metrik fonksiyonları (I/O yok, Date.now yok). Sözleşme: docs/tasarim.md

const GUN_MS = 86400000;

function sayiMi(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

function yasGun(iso, nowMs) {
  if (iso == null) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return (nowMs - t) / GUN_MS;
}

function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

export function median(nums) {
  if (!Array.isArray(nums)) return null;
  const v = nums.filter(sayiMi).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function classifyFormat(durationSec, s) {
  if (!sayiMi(durationSec)) return null;
  if (durationSec >= s.uzunMinSaniye) return 'uzun';
  if (durationSec >= 1 && durationSec <= s.kisaMaxSaniye) return 'kisa';
  return null;
}

export function isSmallOrNew(channel, lang, nowMs, s) {
  if (!channel) return false;
  const e = s.esik[lang];
  if (channel.subscriberCount != null && channel.subscriberCount <= e.kucukKanalAbone) return true;
  const yas = yasGun(channel.publishedAt, nowMs);
  return yas != null && yas <= e.yeniKanalGun;
}

export function videoMetrics(video, channel, lang, nowMs, s) {
  const e = s.esik[lang];
  const yas = yasGun(video.publishedAt, nowMs);
  const ageDays = Math.max(1, yas ?? 1);
  const views = video.viewCount ?? null;
  const subs = channel ? (channel.subscriberCount ?? null) : null;
  const viewsPerDay = views == null ? null : views / ageDays;
  const oran = views == null || subs == null ? null : views / Math.max(subs, e.aboneTabani);
  return {
    ageDays,
    viewsPerDay,
    oran,
    channelAgeDays: channel ? yasGun(channel.publishedAt, nowMs) : null,
    smallOrNew: isSmallOrNew(channel, lang, nowMs, s),
  };
}

export function minIzlenme(lang, format, s) {
  return s.esik[lang].minIzlenme * (format === 'kisa' ? s.kisaCarpani.minIzlenme : 1);
}

export function nicheMetrics(rows, lang, format, s) {
  const e = s.esik[lang];
  const minView = minIzlenme(lang, format, s);

  const enIyi = new Map(); // channelId -> aday
  for (const r of rows) {
    const m = r.m;
    const v = r.video;
    if (!m || !m.smallOrNew || m.oran == null || m.oran < e.oran) continue;
    if (v.viewCount == null || v.viewCount < minView) continue;
    const onceki = enIyi.get(v.channelId);
    if (!onceki || m.oran > onceki.oran) {
      enIyi.set(v.channelId, {
        channelId: v.channelId,
        channelTitle: v.channelTitle ?? r.channel?.title ?? null,
        subscriberCount: r.channel ? (r.channel.subscriberCount ?? null) : null,
        channelAgeDays: m.channelAgeDays ?? null,
        videoId: v.id,
        title: v.title,
        viewCount: v.viewCount,
        oran: m.oran,
      });
    }
  }
  const firsatKanallari = [...enIyi.values()].sort((a, b) => b.oran - a.oran);

  const abonesiBilinen = rows.filter((r) => r.channel && r.channel.subscriberCount != null);
  const buyukKanalPayi = abonesiBilinen.length === 0
    ? null
    : abonesiBilinen.filter((r) => r.channel.subscriberCount >= e.buyukKanalAbone).length / abonesiBilinen.length;

  const kanalli = rows.filter((r) => r.channel);
  const gizliAboneOrani = kanalli.length === 0
    ? null
    : kanalli.filter((r) => r.channel.subscriberCount == null).length / kanalli.length;

  return {
    n: rows.length,
    kanalSayisi: new Set(rows.map((r) => r.video.channelId)).size,
    medianViews: median(rows.map((r) => r.video.viewCount)),
    medianViewsPerDay: median(rows.map((r) => r.m?.viewsPerDay)),
    firsatKanallari,
    buyukKanalPayi,
    gizliAboneOrani,
  };
}

export function rpmLookup(rpm, kategori, lang, format) {
  if (format !== 'uzun' && format !== 'kisa') return null;
  const anahtar = format === 'kisa' ? '*' : kategori;
  const dil = rpm?.[format]?.[lang];
  if (!dil || !Object.hasOwn(dil, anahtar)) return null;
  const band = dil[anahtar];
  return Array.isArray(band) ? band : null;
}

export function maxRpmMid(rpm, lang, format) {
  if (format !== 'uzun' && format !== 'kisa') return null;
  const dil = rpm?.[format]?.[lang];
  if (!dil) return null;
  let en = null;
  for (const band of Object.values(dil)) {
    if (!Array.isArray(band) || !sayiMi(band[0]) || !sayiMi(band[1])) continue;
    const orta = (band[0] + band[1]) / 2;
    if (en == null || orta > en) en = orta;
  }
  return en;
}

export function aylikTahmin(medianViewsPerDay, rpmBand) {
  if (medianViewsPerDay == null || !rpmBand) return null;
  const yuvarla = (x) => Math.round(x * 100) / 100;
  return [
    yuvarla((medianViewsPerDay * 30 * rpmBand[0]) / 1000),
    yuvarla((medianViewsPerDay * 30 * rpmBand[1]) / 1000),
  ];
}

export function nicheScore(metrics, rpmBand, maxMid, lang, format, s) {
  if (!metrics || metrics.n === 0) return null;
  const kisa = format === 'kisa';

  const k = metrics.firsatKanallari.length;
  const firsat = k >= s.firsatMinKanal ? Math.min(100, 25 * k) : 0;

  const ref = s.esik[lang].referansGunlukIzlenme * (kisa ? s.kisaCarpani.referansGunlukIzlenme : 1);
  const vpd = metrics.medianViewsPerDay;
  const talep = vpd == null ? 0 : clamp((100 * Math.log10(1 + vpd)) / Math.log10(1 + ref), 0, 100);

  const acik = metrics.buyukKanalPayi == null ? 50 : 100 * (1 - metrics.buyukKanalPayi);

  let para = 0;
  if (rpmBand && maxMid) {
    const orta = (rpmBand[0] + rpmBand[1]) / 2;
    para = clamp((100 * Math.log(1 + orta)) / Math.log(1 + maxMid), 0, 100);
  }

  const ham = {
    firsat,
    talep,
    acik: clamp(acik, 0, 100),
    para,
  };
  const puan = Math.round(
    s.agirlik.firsat * ham.firsat + s.agirlik.talep * ham.talep + s.agirlik.acik * ham.acik + s.agirlik.para * ham.para,
  );

  const uyarilar = [];
  let siralamaDisi = false;
  if (metrics.n < s.minOrnek) {
    uyarilar.push(`yetersiz örnek (n=${metrics.n})`);
    siralamaDisi = true;
  }
  if (k === 1) uyarilar.push('tek fırsat kanalı; şans olabilir');
  if (metrics.gizliAboneOrani != null && metrics.gizliAboneOrani > 0.3) {
    uyarilar.push('kanalların çoğu abone sayısını gizliyor');
  }
  if (metrics.buyukKanalPayi == null) uyarilar.push('abone verisi yok');
  if (rpmBand == null) uyarilar.push('RPM bandı yok');

  return {
    puan: clamp(puan, 0, 100),
    parcalar: {
      firsat: Math.round(ham.firsat),
      talep: Math.round(ham.talep),
      acik: Math.round(ham.acik),
      para: Math.round(ham.para),
    },
    uyarilar,
    siralamaDisi,
  };
}
