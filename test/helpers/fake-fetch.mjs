import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// YouTube Data API biçiminde sahte yanıtlar (yalnız testler için; ağa çıkmaz).
// createFakeFetch({ nowMs, errors }) -> fetch benzeri fonksiyon; fake.calls yol bazında sayaç,
// fake.requests ise { url, path, headers } listesi.
//
// errors: { search|videos|channels|suggest|thumbnail: { status, reason?, details?, message?, times? } }
//   times verilmezse her çağrıda hata döner.

const GUN = 86400000;
export const SAHTE_KANAL_SAYISI_DIL = 14;

function lcg(seed) {
  let x = seed >>> 0;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 2 ** 32;
  };
}

function hash(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return h;
}

// Kanal tanımları: subs null => abone sayısı gizli, yok => channels yanıtında dönmez.
const KANAL_SABLONU = [
  { subs: 800, yasGun: 200 },        // 0 küçük
  { subs: 3200, yasGun: 900 },       // 1 küçük
  { subs: 7400, yasGun: 1500 },      // 2 küçük
  { subs: 9000, yasGun: 2000 },      // 3 küçük
  { subs: 52000, yasGun: 120 },      // 4 yeni (yaşa göre)
  { subs: 12000, yasGun: 60 },       // 5 yeni
  { subs: 150000, yasGun: 1800 },    // 6 orta
  { subs: 320000, yasGun: 2200 },    // 7 orta
  { subs: 650000, yasGun: 2500 },    // 8 büyük (tr)
  { subs: 2400000, yasGun: 3000 },   // 9 büyük
  { subs: 5100000, yasGun: 3500 },   // 10 büyük
  { subs: null, yasGun: 1000 },      // 11 gizli abone
  { subs: 80000, yasGun: 1400 },     // 12 orta
  { subs: 41000, yasGun: 1100, eksik: true } // 13 channels yanıtında dönmez
];

function buildCatalog(nowMs) {
  const channels = new Map();
  const videos = new Map();
  const byLang = { tr: [], en: [] };
  let kanalNo = 0;

  for (const lang of ['tr', 'en']) {
    const diger = lang === 'tr' ? 'en' : 'tr';
    KANAL_SABLONU.forEach((t, k) => {
      kanalNo += 1;
      const id = `UCSahte${lang}${String(k).padStart(2, '0')}`;
      const rnd = lcg(hash(id));
      const kucuk = k <= 5;
      const buyuk = k >= 8 && k <= 10;
      channels.set(id, {
        id,
        title: `Sahte Kanal ${kanalNo}`,
        publishedAt: new Date(nowMs - t.yasGun * GUN).toISOString(),
        subs: t.subs,
        videoCount: 20 + k * 7,
        eksik: Boolean(t.eksik)
      });

      const uzunSayi = k === 9 ? 5 : 3; // 9. kanalda 5 uzun video: kanal başına sınır testi
      const ekle = (n, over) => {
        const vid = `Sahte${lang}${String(k).padStart(2, '0')}_${n}`;
        const v = {
          id: vid,
          title: `Sahte ${lang === 'tr' ? 'Türkçe' : 'English'} Video ${k}-${n}`,
          channelId: id,
          publishedAt: new Date(nowMs - (10 + Math.floor(rnd() * 150)) * GUN).toISOString(),
          duration: 'PT10M30S',
          views: 1000,
          live: 'none',
          audio: lang === 'tr' ? (n % 2 ? 'tr' : undefined) : (n % 2 ? 'en-US' : 'en'),
          ...over
        };
        videos.set(vid, v);
        byLang[lang].push(vid);
        return v;
      };

      for (let n = 0; n < uzunSayi; n++) {
        const views = kucuk
          ? 60000 + Math.floor(rnd() * 140000)
          : buyuk
            ? 400000 + Math.floor(rnd() * 1800000)
            : 4000 + Math.floor(rnd() * 90000);
        ekle(n, { views, duration: `PT${8 + n}M${10 + k}S` });
      }
      // kısa video (45-59 sn)
      ekle(10, {
        views: kucuk ? 600000 + Math.floor(rnd() * 900000) : buyuk ? 5000000 : 20000 + Math.floor(rnd() * 150000),
        duration: `PT${45 + (k % 15)}S`
      });
      if (k === 2) {
        // 181..239 sn arası: ne uzun ne kısa
        ekle(11, { views: 90000, duration: 'PT3M20S' });
        // izlenme sayısı yok
        ekle(12, { views: null, duration: 'PT12M' });
      }
    });

    // Canlı yayın ve yaklaşan yayın (P0D), yanlış dil, 'und'/'zxx' etiketleri.
    const e = (suffix, over) => {
      const kanal = `UCSahte${lang}06`;
      const vid = `Sahte${lang}_${suffix}`;
      videos.set(vid, {
        id: vid,
        title: `Sahte ${suffix}`,
        channelId: kanal,
        publishedAt: new Date(nowMs - 20 * GUN).toISOString(),
        duration: 'PT10M',
        views: 900000,
        live: 'none',
        audio: undefined,
        ...over
      });
      byLang[lang].push(vid);
    };
    e('canli', { live: 'live', duration: 'P0D', views: 5000000 });
    e('yaklasan', { live: 'upcoming', duration: 'P0D', views: 0 });
    // yanlış dil: küçük kanalda yüksek izlenmeli ama diğer dilde
    videos.set(`Sahte${lang}_yanlis-dil`, {
      id: `Sahte${lang}_yanlis-dil`,
      title: 'Sahte Yanlış Dil Videosu',
      channelId: `UCSahte${lang}00`,
      publishedAt: new Date(nowMs - 15 * GUN).toISOString(),
      duration: 'PT15M',
      views: 3000000,
      live: 'none',
      audio: diger
    });
    byLang[lang].push(`Sahte${lang}_yanlis-dil`);
    e('und', { audio: 'und', views: 33000 });
    e('zxx', { audio: 'zxx', views: 31000 });
  }
  return { channels, videos, byLang };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=UTF-8', ...headers }
  });
}

export function createFakeFetch({ nowMs, errors = {} } = {}) {
  const now = nowMs ?? Date.now();
  const cat = buildCatalog(now);
  const injected = {};
  const calls = {};
  const requests = [];

  function headersToObject(h) {
    const o = {};
    if (!h) return o;
    if (typeof h.forEach === 'function' && !Array.isArray(h)) h.forEach((v, k) => { o[k.toLowerCase()] = v; });
    else for (const [k, v] of Object.entries(h)) o[k.toLowerCase()] = v;
    return o;
  }

  function maybeError(name) {
    const e = errors[name];
    if (!e) return null;
    injected[name] = (injected[name] ?? 0) + 1;
    if (e.times !== undefined && injected[name] > e.times) return null;
    const reason = e.reason ?? (e.status === 429 ? 'rateLimitExceeded' : e.status === 403 ? 'forbidden' : 'backendError');
    const body = {
      error: {
        code: e.status,
        message: e.message ?? `Sahte hata (${e.status})`,
        errors: e.noErrors ? undefined : [{ message: e.message ?? 'Sahte hata', domain: 'youtube.quota', reason }],
        ...(e.details ? { details: e.details } : {})
      }
    };
    return json(body, e.status);
  }

  async function fake(url, init = {}) {
    const u = new URL(String(url));
    const p = u.pathname;
    calls[p] = (calls[p] ?? 0) + 1;
    requests.push({ url: String(url), path: p, headers: headersToObject(init.headers) });

    if (u.hostname === 'www.googleapis.com') {
      const name = p.split('/').pop();
      const err = maybeError(name);
      if (err) return err;

      if (name === 'search') {
        const lang = u.searchParams.get('relevanceLanguage') === 'en' ? 'en' : 'tr';
        const q = u.searchParams.get('q') ?? '';
        const max = Math.min(Number(u.searchParams.get('maxResults') ?? 50), 50);
        const list = cat.byLang[lang];
        // Küçük/yeni kanallar, 9. kanal, canlı ve yanlış dilli videolar her sorguda gelir;
        // kalanı sorguya göre döndürülür (arama sonucu 50 ile sınırlıdır).
        const kritik = /^Sahte(?:tr|en)(?:0[0-5]|09)_|^Sahte(?:tr|en)_(?:yanlis-dil|canli|yaklasan)$/;
        const head = list.filter((id) => kritik.test(id));
        const tail = list.filter((id) => !kritik.test(id));
        const off = hash(q) % tail.length;
        const ids = [...head, ...tail.slice(off), ...tail.slice(0, off)].slice(0, max);
        return json({
          kind: 'youtube#searchListResponse',
          pageInfo: { totalResults: 1000000, resultsPerPage: ids.length },
          items: ids.map((id) => ({
            kind: 'youtube#searchResult',
            id: { kind: 'youtube#video', videoId: id },
            snippet: { title: cat.videos.get(id).title }
          }))
        });
      }

      if (name === 'videos') {
        const ids = (u.searchParams.get('id') ?? '').split(',').filter(Boolean);
        const items = [];
        for (const id of ids) {
          const v = cat.videos.get(id);
          if (!v) continue;
          const ch = cat.channels.get(v.channelId);
          const snippet = {
            publishedAt: v.publishedAt,
            channelId: v.channelId,
            title: v.title,
            thumbnails: {
              default: { url: `https://i.ytimg.com/vi/${id}/default.jpg`, width: 120, height: 90 },
              medium: { url: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`, width: 320, height: 180 }
            },
            channelTitle: ch.title,
            liveBroadcastContent: v.live
          };
          if (v.audio !== undefined) snippet.defaultAudioLanguage = v.audio;
          const statistics = { likeCount: '10', commentCount: '2' };
          if (v.views !== null) statistics.viewCount = String(v.views);
          items.push({
            kind: 'youtube#video',
            id,
            snippet,
            contentDetails: { duration: v.duration, dimension: '2d', definition: 'hd' },
            statistics
          });
        }
        return json({ kind: 'youtube#videoListResponse', items });
      }

      if (name === 'channels') {
        const ids = (u.searchParams.get('id') ?? '').split(',').filter(Boolean);
        const items = [];
        for (const id of ids) {
          const c = cat.channels.get(id);
          if (!c || c.eksik) continue;
          const statistics = {
            viewCount: String((c.subs ?? 500000) * 40),
            videoCount: String(c.videoCount),
            hiddenSubscriberCount: c.subs === null
          };
          if (c.subs !== null) statistics.subscriberCount = String(c.subs);
          items.push({
            kind: 'youtube#channel',
            id,
            snippet: { title: c.title, publishedAt: c.publishedAt },
            statistics
          });
        }
        return json({ kind: 'youtube#channelListResponse', items });
      }
      return json({ error: { code: 404, message: 'Bilinmeyen uç', errors: [{ reason: 'notFound' }] } }, 404);
    }

    if (u.hostname === 'suggestqueries.google.com') {
      const err = maybeError('suggest');
      if (err) return err;
      const q = u.searchParams.get('q') ?? '';
      const body = JSON.stringify([q, [q, `${q} özet`, `${q} şu ğ ı`, `${q} belgesel`, `${q} özet`]]);
      return new Response(new TextEncoder().encode(body), {
        status: 200,
        headers: { 'content-type': 'text/javascript; charset=UTF-8' }
      });
    }

    if (u.hostname === 'i.ytimg.com') {
      const err = maybeError('thumbnail');
      if (err) return err;
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x53, 0x41, 0x48, 0x54, 0x45, 0xff, 0xd9]), {
        status: 200,
        headers: { 'content-type': 'image/jpeg' }
      });
    }

    throw new Error(`Sahte fetch: beklenmeyen istek ${u.hostname}`);
  }

  fake.calls = calls;
  fake.requests = requests;
  fake.catalog = cat;
  return fake;
}

// Geçici rootDir hazırlar: gerçek config/*.json kopyalanır, ek kabul bayrağı ayarlanır.
// Gerçek data/kota.json ve out/ klasörlerine dokunulmaz.
export function prepareRoot(dir, { derived = true, ayarlar } = {}) {
  const src = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'config');
  const dst = path.join(dir, 'config');
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    if (f.endsWith('.json')) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  const p = path.join(dst, 'ayarlar.json');
  const s = JSON.parse(fs.readFileSync(p, 'utf8'));
  s.turetilmisMetrikEkiKabulEdildi = derived;
  if (ayarlar) ayarlar(s);
  fs.writeFileSync(p, JSON.stringify(s, null, 2));
  return dir;
}
