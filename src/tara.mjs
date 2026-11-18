import fs from 'node:fs';
import path from 'node:path';
import { ApiKeyError, QuotaExceededError } from './errors.mjs';
import { createQuota } from './quota.mjs';
import { createClient } from './youtube.mjs';
import { claimRunDir, makeRunId } from './temizlik.mjs';
import {
  aylikTahmin, classifyFormat, maxRpmMid, nicheMetrics, nicheScore, rpmLookup, videoMetrics
} from './metrics.mjs';
import { buildReport } from './report.mjs';

const GUN_MS = 24 * 60 * 60 * 1000;
const KAPAK_SAYISI = 12;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
}

function emptyCell(lang, format, queries, error) {
  return { lang, format, queries, rows: [], metrics: null, score: null, rpmBand: null, aylikTahmin: null, error };
}

export async function runScan({ nicheIds, langs, formats, days, nowMs, rootDir, apiKey, fetchImpl, sleep, log = () => {} }) {
  const cfgDir = path.join(rootDir, 'config');
  const s = readJson(path.join(cfgDir, 'ayarlar.json'));
  const nisler = readJson(path.join(cfgDir, 'nisler.json')).nisler;
  const rpm = readJson(path.join(cfgDir, 'rpm.json'));

  const derived = s.turetilmisMetrikEkiKabulEdildi === true;
  langs = langs?.length ? langs : ['tr', 'en'];
  formats = formats?.length ? formats : ['uzun', 'kisa'];
  days = days ?? s.arama.gun;

  let secili = nisler;
  if (nicheIds?.length) {
    const bilinmeyen = nicheIds.filter((id) => !nisler.some((n) => n.id === id));
    if (bilinmeyen.length) throw new Error(`Bilinmeyen niş kimliği: ${bilinmeyen.join(', ')}`);
    secili = nicheIds.map((id) => nisler.find((n) => n.id === id));
  }

  const quota = createQuota({ path: path.join(rootDir, 'data', 'kota.json'), settings: s, nowFn: () => nowMs });
  const client = createClient({ apiKey, fetchImpl, quota, sleep, log });
  const publishedAfter = nowMs - days * GUN_MS;

  let stoppedEarly = false;
  let stopReason = null;

  async function scanGroup(niche, lang) {
    const queries = niche[lang] ?? [];
    const ids = [];
    const seen = new Set();
    let hatali = 0;
    let ilkHata = null;
    for (const q of queries) {
      try {
        const found = await client.search({
          q, lang, regionCode: s.arama.bolge[lang], publishedAfter, maxResults: 50
        });
        for (const id of found) {
          if (!seen.has(id)) { seen.add(id); ids.push(id); }
        }
      } catch (e) {
        if (e instanceof QuotaExceededError || e instanceof ApiKeyError) throw e;
        hatali++;
        ilkHata ??= e;
        log(`Arama ifadesi atlandı (${niche.id}/${lang}): ${e.message}`);
      }
    }
    if (queries.length > 0 && hatali === queries.length) throw ilkHata;

    const all = ids.length ? await client.videos(ids) : [];
    const videos = all.filter((v) => v.liveBroadcastContent === 'none' && (v.language === null || v.language === lang));

    const channelIds = [...new Set(videos.map((v) => v.channelId).filter(Boolean))];
    const channels = channelIds.length ? await client.channels(channelIds) : [];
    const chMap = new Map(channels.map((c) => [c.id, c]));

    // Kanal başına en çok kanalBasinaMaxVideo video (izlenmeye göre en yüksekler).
    const byChannel = new Map();
    for (const v of videos) {
      const k = v.channelId ?? `?${v.id}`;
      if (!byChannel.has(k)) byChannel.set(k, []);
      byChannel.get(k).push(v);
    }
    const kept = [];
    for (const list of byChannel.values()) {
      list.sort((a, b) => (b.viewCount ?? -1) - (a.viewCount ?? -1));
      kept.push(...list.slice(0, s.kanalBasinaMaxVideo));
    }
    kept.sort((a, b) => (b.viewCount ?? -1) - (a.viewCount ?? -1));

    return formats.map((format) => {
      const rows = kept
        .filter((v) => classifyFormat(v.durationSec, s) === format)
        .map((video) => ({ video, channel: chMap.get(video.channelId) ?? null, m: null }));
      if (rows.length === 0) return emptyCell(lang, format, queries, 'uygun video yok');
      if (!derived) return { ...emptyCell(lang, format, queries, null), rows };
      for (const r of rows) r.m = videoMetrics(r.video, r.channel, lang, nowMs, s);
      const metrics = nicheMetrics(rows, lang, format, s);
      const rpmBand = rpmLookup(rpm, niche.kategori, lang, format);
      const score = nicheScore(metrics, rpmBand, maxRpmMid(rpm, lang, format), lang, format, s);
      return {
        lang, format, queries, rows, metrics, score, rpmBand,
        aylikTahmin: aylikTahmin(metrics.medianViewsPerDay, rpmBand),
        error: null
      };
    });
  }

  const nichesOut = [];
  let keyFailure = false;
  outer:
  for (const niche of secili) {
    const entry = { id: niche.id, etiket: niche.etiket, kategori: niche.kategori, cells: [] };
    nichesOut.push(entry);
    for (const lang of langs) {
      if (stoppedEarly) {
        for (const format of formats) entry.cells.push(emptyCell(lang, format, niche[lang] ?? [], 'kota'));
        continue;
      }
      try {
        entry.cells.push(...await scanGroup(niche, lang));
      } catch (e) {
        if (e instanceof ApiKeyError) { keyFailure = true; break outer; }
        if (e instanceof QuotaExceededError) {
          stoppedEarly = true;
          stopReason = e.source;
          for (const format of formats) entry.cells.push(emptyCell(lang, format, niche[lang] ?? [], 'kota'));
          continue;
        }
        log(`Hücre grubu hatası (${niche.id}/${lang}): ${e.message}`);
        for (const format of formats) entry.cells.push(emptyCell(lang, format, niche[lang] ?? [], e.message));
      }
    }
  }

  if (keyFailure) {
    log('YouTube API anahtarı reddedildi (geçersiz, kısıtlı ya da YouTube Data API v3 etkin değil). Rapor yazılmadı.');
    return { runId: null, outPath: null, quota: quota.status(), exitCode: 2 };
  }

  const status = quota.status();
  const runData = {
    runId: null,
    createdAt: new Date(nowMs).toISOString(),
    finishedAt: new Date().toISOString(),
    derivedMetrics: derived,
    quota: {
      day: status.day,
      searchUsed: status.searchUsed,
      unitsUsed: status.unitsUsed,
      searchLimit: status.searchLimit,
      unitsLimit: status.unitsLimit,
      stoppedEarly,
      stopReason
    },
    params: { langs, formats, days },
    niches: nichesOut
  };

  const claimed = claimRunDir(path.join(rootDir, 'out'), makeRunId(nowMs));
  runData.runId = claimed.runId;
  const outPath = claimed.dir;
  const { markdown, json } = buildReport(runData, s);
  fs.writeFileSync(path.join(outPath, 'rapor.md'), markdown);
  fs.writeFileSync(path.join(outPath, 'rapor.json'), JSON.stringify(json, null, 2));
  fs.writeFileSync(path.join(outPath, 'meta.json'), JSON.stringify({ createdAt: runData.createdAt }));

  if (derived) await downloadCovers(nichesOut, outPath, fetchImpl, log);

  log(`Rapor: ${path.join(outPath, 'rapor.md')}`);
  log(`Kota: arama ${status.searchUsed}/${status.searchLimit}, birim ${status.unitsUsed}/${status.unitsLimit}`);
  if (stoppedEarly) log(`Tarama erken durdu: ${stopReason === 'google' ? 'Google kotayı reddetti' : 'yerel pay doldu'}`);

  return { runId: claimed.runId, outPath, quota: quota.status(), exitCode: 0 };
}

// Fırsat kanallarından orana göre en iyi 12 videonun kapağı; anahtarsız düz fetch.
async function downloadCovers(niches, outPath, fetchImpl, log) {
  const thumbs = new Map();
  const cands = [];
  for (const n of niches) {
    for (const c of n.cells) {
      for (const r of c.rows) thumbs.set(r.video.id, r.video.thumbnailUrl);
      for (const f of c.metrics?.firsatKanallari ?? []) cands.push(f);
    }
  }
  cands.sort((a, b) => (b.oran ?? 0) - (a.oran ?? 0));
  const picked = [];
  for (const f of cands) {
    if (picked.length >= KAPAK_SAYISI) break;
    if (!picked.includes(f.videoId) && thumbs.get(f.videoId)) picked.push(f.videoId);
  }
  if (picked.length === 0) return;
  const dir = path.join(outPath, 'kapaklar');
  fs.mkdirSync(dir, { recursive: true });
  for (const id of picked) {
    try {
      const res = await fetchImpl(thumbs.get(id));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fs.writeFileSync(path.join(dir, `${id}.jpg`), Buffer.from(await res.arrayBuffer()));
    } catch (e) {
      log(`Kapak indirilemedi (${id}): ${e.message}`);
    }
  }
}
