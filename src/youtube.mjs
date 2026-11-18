import { ApiError, ApiKeyError, QuotaExceededError } from './errors.mjs';

const BASE = 'https://www.googleapis.com/youtube/v3/';
const QUOTA_REASONS = new Set(['quotaExceeded', 'dailyLimitExceeded']);
const KEY_REASONS = new Set([
  'keyInvalid', 'API_KEY_INVALID', 'accessNotConfigured', 'SERVICE_DISABLED',
  'API_KEY_SERVICE_BLOCKED', 'ipRefererBlocked', 'API_KEY_HTTP_REFERRER_BLOCKED',
  'API_KEY_IP_ADDRESS_BLOCKED'
]);
const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded']);
const RETRY_DELAYS = [1000, 3000];
const DEFAULT_SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

export function parseIsoDuration(str) {
  if (typeof str !== 'string') return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(str);
  if (!m || str === 'P' || str.endsWith('T')) return null;
  const [, d, h, mi, s] = m;
  return Math.round((+d || 0) * 86400 + (+h || 0) * 3600 + (+mi || 0) * 60 + (+s || 0));
}

function toNum(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function primaryLang(tag) {
  if (typeof tag !== 'string' || !tag) return null;
  const p = tag.split(/[-_]/)[0].toLowerCase();
  return !p || p === 'und' || p === 'zxx' ? null : p;
}

export function mapVideo(item) {
  const sn = item.snippet ?? {};
  const st = item.statistics ?? {};
  const th = sn.thumbnails ?? {};
  return {
    id: item.id,
    title: sn.title ?? '',
    channelId: sn.channelId ?? null,
    channelTitle: sn.channelTitle ?? '',
    publishedAt: sn.publishedAt ?? null,
    durationSec: parseIsoDuration(item.contentDetails?.duration),
    viewCount: toNum(st.viewCount),
    thumbnailUrl: th.medium?.url ?? th.default?.url ?? null,
    language: primaryLang(sn.defaultAudioLanguage ?? sn.defaultLanguage),
    liveBroadcastContent: sn.liveBroadcastContent ?? 'none'
  };
}

export function mapChannel(item) {
  const st = item.statistics ?? {};
  return {
    id: item.id,
    title: item.snippet?.title ?? '',
    publishedAt: item.snippet?.publishedAt ?? null,
    subscriberCount: st.hiddenSubscriberCount === true ? null : toNum(st.subscriberCount),
    videoCount: toNum(st.videoCount)
  };
}

export function createClient({ apiKey, fetchImpl = fetch, quota, sleep = DEFAULT_SLEEP, log = () => {} }) {
  // Hata metninden URL ve anahtar izlerini temizler.
  function safe(text) {
    let t = String(text ?? '');
    if (apiKey) t = t.split(apiKey).join('***');
    t = t.replace(/https?:\/\/\S+/g, '[url]').replace(/([?&]key=)[^&\s]+/gi, '$1***');
    return t.slice(0, 200);
  }

  async function call(endpoint, params, bucket) {
    const url = `${BASE}${endpoint}?${new URLSearchParams(params).toString()}`;
    for (let attempt = 0; ; attempt++) {
      if (bucket === 'search') quota.useSearch(1); else quota.useUnits(1);

      let res = null;
      let netReason = null;
      try {
        res = await fetchImpl(url, {
          headers: { 'X-Goog-Api-Key': apiKey, Accept: 'application/json' },
          signal: AbortSignal.timeout(15000)
        });
      } catch (e) {
        netReason = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'timeout' : 'network';
      }

      if (res && res.ok) {
        try {
          return await res.json();
        } catch {
          throw new ApiError(res.status, 'badResponse', 'YouTube yanıtı çözümlenemedi');
        }
      }

      let status = 0;
      let reasons = [];
      let message = netReason === 'timeout' ? 'İstek zaman aşımına uğradı' : 'Ağ hatası';
      if (res) {
        status = res.status;
        let err = null;
        try { err = (await res.json())?.error ?? null; } catch { /* gövde JSON değil */ }
        reasons = [err?.errors?.[0]?.reason, ...(Array.isArray(err?.details) ? err.details.map((d) => d?.reason) : [])]
          .filter((r) => typeof r === 'string' && r);
        message = safe(err?.message) || `HTTP ${status}`;
      }
      const reason = reasons[0] ?? netReason ?? null;

      const quotaReason = reasons.find((r) => QUOTA_REASONS.has(r));
      if (quotaReason) {
        quota.markExhausted(bucket);
        throw new QuotaExceededError('google', bucket);
      }
      const keyReason = reasons.find((r) => KEY_REASONS.has(r));
      if (keyReason) throw new ApiKeyError(keyReason);

      const retryable = !res || status >= 500 || status === 429 || reasons.some((r) => RATE_REASONS.has(r));
      if (retryable && attempt < RETRY_DELAYS.length) {
        log(`YouTube isteği yeniden denenecek (${endpoint}, ${status || reason}, deneme ${attempt + 1})`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      throw new ApiError(status, reason, message);
    }
  }

  async function batched(endpoint, part, ids, mapper) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      // maxResults, id parametresiyle birlikte desteklenmiyor (YouTube belgesi); 50 kimliğin hepsi döner.
      const data = await call(endpoint, { part, id: chunk.join(',') }, 'units');
      for (const item of data.items ?? []) out.push(mapper(item));
    }
    return out;
  }

  return {
    async search({ q, lang, regionCode, publishedAfter, maxResults = 50 }) {
      const params = {
        part: 'snippet',
        type: 'video',
        order: 'relevance',
        q,
        relevanceLanguage: lang,
        maxResults: String(maxResults)
      };
      if (regionCode) params.regionCode = regionCode;
      if (publishedAfter !== undefined && publishedAfter !== null) {
        params.publishedAfter = new Date(publishedAfter).toISOString().replace(/\.\d{3}Z$/, 'Z');
      }
      const data = await call('search', params, 'search');
      return (data.items ?? []).map((it) => it?.id?.videoId).filter(Boolean);
    },
    videos: (ids) => batched('videos', 'snippet,statistics,contentDetails', ids, mapVideo),
    channels: (ids) => batched('channels', 'snippet,statistics', ids, mapChannel)
  };
}
