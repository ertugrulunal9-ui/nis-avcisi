import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient, parseIsoDuration } from '../src/youtube.mjs';
import { createQuota } from '../src/quota.mjs';
import { ApiError, ApiKeyError, QuotaExceededError } from '../src/errors.mjs';
import { createFakeFetch } from './helpers/fake-fetch.mjs';

const KEY = 'SAHTE-TEST-ANAHTARI-123';
const NOW = Date.UTC(2026, 10, 18, 12);
const settings = { kota: { aramaPayi: 10, birimPayi: 10 } };

function setup({ fetchImpl, kota = settings } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nis-yt-'));
  const quota = createQuota({ path: path.join(dir, 'kota.json'), settings: kota, nowFn: () => NOW });
  const sleeps = [];
  const logs = [];
  const client = createClient({
    apiKey: KEY, fetchImpl, quota, sleep: async (ms) => { sleeps.push(ms); }, log: (m) => logs.push(m)
  });
  return { client, quota, sleeps, logs };
}

const errBody = (status, reason, extra = {}) => () => new Response(JSON.stringify({
  error: { code: status, message: 'Sahte hata', errors: reason ? [{ reason }] : undefined, ...extra }
}), { status, headers: { 'content-type': 'application/json' } });

test('parseIsoDuration', () => {
  assert.equal(parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(parseIsoDuration('P1DT2H'), 93600);
  assert.equal(parseIsoDuration('P0D'), 0);
  assert.equal(parseIsoDuration('PT45S'), 45);
  assert.equal(parseIsoDuration('PT3M'), 180);
  assert.equal(parseIsoDuration('abc'), null);
  assert.equal(parseIsoDuration(''), null);
  assert.equal(parseIsoDuration(null), null);
  assert.equal(parseIsoDuration(undefined), null);
  assert.equal(parseIsoDuration('PT'), null);
});

test('anahtar yalnız başlıkta, URL ve hata mesajında yok', async () => {
  const fake = createFakeFetch({ nowMs: NOW });
  const { client } = setup({ fetchImpl: fake });
  const ids = await client.search({ q: 'tarih', lang: 'tr', regionCode: 'TR', publishedAfter: NOW - 1e9, maxResults: 50 });
  assert.ok(ids.length > 0);
  await client.videos(ids.slice(0, 3));
  await client.channels(['UCSahtetr00']);
  assert.equal(fake.requests.length, 3);
  for (const r of fake.requests) {
    assert.equal(r.headers['x-goog-api-key'], KEY);
    assert.ok(!r.url.includes(KEY));
    assert.ok(!/key=/i.test(r.url));
    assert.ok(r.url.startsWith('https://www.googleapis.com/youtube/v3/'));
  }
  const u = new URL(fake.requests[0].url);
  assert.equal(u.searchParams.get('type'), 'video');
  assert.equal(u.searchParams.get('order'), 'relevance');
  assert.equal(u.searchParams.get('relevanceLanguage'), 'tr');
  assert.equal(u.searchParams.get('regionCode'), 'TR');
  assert.equal(u.searchParams.get('maxResults'), '50');
  // RFC 3339, saniye hassasiyetinde (milisaniyesiz)
  assert.equal(u.searchParams.get('publishedAfter'), new Date(NOW - 1e9).toISOString().replace(/\.\d{3}Z$/, 'Z'));
  assert.equal(new URL(fake.requests[1].url).searchParams.get('part'), 'snippet,statistics,contentDetails');
  // maxResults, id ile birlikte desteklenmiyor
  assert.equal(new URL(fake.requests[1].url).searchParams.get('maxResults'), null);
  assert.equal(new URL(fake.requests[2].url).searchParams.get('maxResults'), null);
  assert.equal(new URL(fake.requests[2].url).searchParams.get('part'), 'snippet,statistics');
});

test('Google hata metnindeki anahtar ve URL temizlenir', async () => {
  const f = async () => new Response(JSON.stringify({
    error: { code: 400, message: `Kötü istek ${KEY} https://www.googleapis.com/youtube/v3/search?key=${KEY}&q=x`, errors: [{ reason: 'badRequest' }] }
  }), { status: 400 });
  const { client } = setup({ fetchImpl: f });
  await assert.rejects(
    () => client.videos(['a']),
    (e) => e instanceof ApiError && e.status === 400 && e.reason === 'badRequest'
      && !e.message.includes(KEY) && !e.message.includes('http') && !String(e.stack).includes(KEY)
  );
});

test('kota her HTTP denemesinde sayılır (arama 1, birim 1)', async () => {
  const fake = createFakeFetch({ nowMs: NOW });
  const { client, quota } = setup({ fetchImpl: fake });
  await client.search({ q: 'a', lang: 'en', regionCode: 'US', publishedAfter: NOW, maxResults: 50 });
  assert.equal(quota.status().searchUsed, 1);
  assert.equal(quota.status().unitsUsed, 0);
  // 120 kimlik => 3 parti => 3 birim
  const ids = [...fake.catalog.videos.keys()].slice(0, 120);
  const out = await client.videos(ids);
  assert.equal(out.length, 120);
  assert.equal(fake.calls['/youtube/v3/videos'], 3);
  assert.equal(quota.status().unitsUsed, 3);
  assert.deepEqual(await client.videos([]), []);
  assert.equal(fake.calls['/youtube/v3/videos'], 3);
});

test('yerel pay doluysa HTTP isteği gitmez', async () => {
  const fake = createFakeFetch({ nowMs: NOW });
  const { client } = setup({ fetchImpl: fake, kota: { kota: { aramaPayi: 0, birimPayi: 10 } } });
  await assert.rejects(
    () => client.search({ q: 'a', lang: 'tr', regionCode: 'TR', publishedAfter: NOW, maxResults: 50 }),
    (e) => e instanceof QuotaExceededError && e.source === 'yerel'
  );
  assert.equal(fake.requests.length, 0);
});

test('429 yeniden denenir; her deneme kotadan yer', async () => {
  const fake = createFakeFetch({ nowMs: NOW, errors: { search: { status: 429, times: 2 } } });
  const { client, quota, sleeps } = setup({ fetchImpl: fake });
  const ids = await client.search({ q: 'a', lang: 'tr', regionCode: 'TR', publishedAfter: NOW, maxResults: 50 });
  assert.ok(ids.length > 0);
  assert.equal(fake.calls['/youtube/v3/search'], 3);
  assert.deepEqual(sleeps, [1000, 3000]);
  assert.equal(quota.status().searchUsed, 3);
});

test('5xx 2 denemeden sonra ApiError; ağ hatası da yeniden denenir', async () => {
  const fake = createFakeFetch({ nowMs: NOW, errors: { videos: { status: 500 } } });
  const { client, quota, sleeps } = setup({ fetchImpl: fake });
  await assert.rejects(() => client.videos(['x']), (e) => e instanceof ApiError && e.status === 500);
  assert.equal(fake.calls['/youtube/v3/videos'], 3);
  assert.deepEqual(sleeps, [1000, 3000]);
  assert.equal(quota.status().unitsUsed, 3);

  let n = 0;
  const flaky = async () => {
    n++;
    if (n < 3) throw new TypeError(`fetch failed https://www.googleapis.com/?key=${KEY}`);
    return new Response(JSON.stringify({ items: [] }));
  };
  const b = setup({ fetchImpl: flaky });
  assert.deepEqual(await b.client.channels(['a']), []);
  assert.equal(n, 3);

  const always = async () => { throw new TypeError(`fetch failed ${KEY}`); };
  const c = setup({ fetchImpl: always });
  await assert.rejects(
    () => c.client.channels(['a']),
    (e) => e instanceof ApiError && e.status === 0 && !e.message.includes(KEY)
  );
});

test('rateLimitExceeded (403) yeniden denenir', async () => {
  const fake = createFakeFetch({ nowMs: NOW, errors: { channels: { status: 403, reason: 'rateLimitExceeded', times: 1 } } });
  const { client, sleeps } = setup({ fetchImpl: fake });
  const out = await client.channels(['UCSahtetr00']);
  assert.equal(out.length, 1);
  assert.deepEqual(sleeps, [1000]);
});

test('400 yeniden denenmez', async () => {
  const fake = createFakeFetch({ nowMs: NOW, errors: { videos: { status: 400, reason: 'invalidParameter' } } });
  const { client, sleeps } = setup({ fetchImpl: fake });
  await assert.rejects(() => client.videos(['x']), (e) => e instanceof ApiError && e.reason === 'invalidParameter');
  assert.equal(fake.calls['/youtube/v3/videos'], 1);
  assert.deepEqual(sleeps, []);
});

test('details[].reason = API_KEY_INVALID => ApiKeyError', async () => {
  const f = errBody(400, null, { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'API_KEY_INVALID', domain: 'googleapis.com' }] });
  const { client } = setup({ fetchImpl: f });
  await assert.rejects(
    () => client.search({ q: 'a', lang: 'tr', regionCode: 'TR', publishedAfter: NOW }),
    (e) => e instanceof ApiKeyError && e.reason === 'API_KEY_INVALID' && !e.message.includes(KEY)
  );
});

test('errors[0].reason anahtar nedenleri => ApiKeyError', async () => {
  for (const reason of ['keyInvalid', 'accessNotConfigured', 'ipRefererBlocked']) {
    const { client } = setup({ fetchImpl: errBody(403, reason) });
    await assert.rejects(() => client.videos(['a']), (e) => e instanceof ApiKeyError && e.reason === reason);
  }
});

test('quotaExceeded => markExhausted + QuotaExceededError(google)', async () => {
  const fake = createFakeFetch({ nowMs: NOW, errors: { search: { status: 403, reason: 'quotaExceeded' } } });
  const { client, quota } = setup({ fetchImpl: fake });
  await assert.rejects(
    () => client.search({ q: 'a', lang: 'tr', regionCode: 'TR', publishedAfter: NOW }),
    (e) => e instanceof QuotaExceededError && e.source === 'google' && e.bucket === 'search'
  );
  assert.equal(quota.status().searchUsed, quota.status().searchLimit);
  assert.equal(quota.status().unitsUsed, 0);
  assert.equal(fake.calls['/youtube/v3/search'], 1);
  // sonraki istek yerel olarak reddedilir, HTTP'ye gitmez
  await assert.rejects(
    () => client.search({ q: 'a', lang: 'tr', regionCode: 'TR', publishedAfter: NOW }),
    (e) => e instanceof QuotaExceededError && e.source === 'yerel'
  );
  assert.equal(fake.calls['/youtube/v3/search'], 1);
});

test('quotaExceeded details[] içinde de aranır; dailyLimitExceeded birim kovasını doldurur', async () => {
  const f = errBody(403, null, { details: [{ reason: 'quotaExceeded' }] });
  const a = setup({ fetchImpl: f });
  await assert.rejects(() => a.client.videos(['a']), (e) => e instanceof QuotaExceededError && e.source === 'google' && e.bucket === 'units');
  assert.equal(a.quota.status().unitsLeft, 0);
  const b = setup({ fetchImpl: errBody(403, 'dailyLimitExceeded') });
  await assert.rejects(() => b.client.channels(['a']), (e) => e instanceof QuotaExceededError && e.source === 'google');
});

test('video eşleme: dize sayılar, eksik izlenme, P0D canlı, dil etiketi, küçük resim', async () => {
  const body = {
    items: [
      {
        id: 'v1',
        snippet: {
          title: 'Bir', channelId: 'c1', channelTitle: 'Sahte Kanal 1', publishedAt: '2026-01-01T00:00:00Z',
          thumbnails: { default: { url: 'd.jpg' }, medium: { url: 'm.jpg' } }, liveBroadcastContent: 'none', defaultAudioLanguage: 'en-US'
        },
        contentDetails: { duration: 'PT10M5S' }, statistics: { viewCount: '12345' }
      },
      {
        id: 'v2',
        snippet: { title: 'İki', channelId: 'c1', thumbnails: { default: { url: 'd2.jpg' } }, liveBroadcastContent: 'live', defaultLanguage: 'TR' },
        contentDetails: { duration: 'P0D' }, statistics: {}
      },
      {
        id: 'v3',
        snippet: { title: 'Üç', channelId: 'c2', liveBroadcastContent: 'none', defaultAudioLanguage: 'zxx' },
        contentDetails: { duration: 'PT59S' }, statistics: { viewCount: '0' }
      },
      { id: 'v4', snippet: { channelId: 'c2', defaultAudioLanguage: 'und' }, contentDetails: {}, statistics: { viewCount: '7' } }
    ]
  };
  const { client } = setup({ fetchImpl: async () => new Response(JSON.stringify(body)) });
  const [v1, v2, v3, v4] = await client.videos(['v1', 'v2', 'v3', 'v4']);
  assert.deepEqual(v1, {
    id: 'v1', title: 'Bir', channelId: 'c1', channelTitle: 'Sahte Kanal 1', publishedAt: '2026-01-01T00:00:00Z',
    durationSec: 605, viewCount: 12345, thumbnailUrl: 'm.jpg', language: 'en', liveBroadcastContent: 'none'
  });
  assert.equal(v2.durationSec, 0);
  assert.equal(v2.viewCount, null);
  assert.equal(v2.thumbnailUrl, 'd2.jpg');
  assert.equal(v2.language, 'tr');
  assert.equal(v2.liveBroadcastContent, 'live');
  assert.equal(v3.language, null);
  assert.equal(v3.viewCount, 0);
  assert.equal(v3.durationSec, 59);
  assert.equal(v4.language, null);
  assert.equal(v4.durationSec, null);
  assert.equal(v4.thumbnailUrl, null);
});

test('kanal eşleme: gizli abone null, eksik sayılar null', async () => {
  const body = {
    items: [
      { id: 'c1', snippet: { title: 'Sahte Kanal 1', publishedAt: '2020-01-01T00:00:00Z' }, statistics: { subscriberCount: '1500', videoCount: '40', hiddenSubscriberCount: false } },
      { id: 'c2', snippet: { title: 'Sahte Kanal 2', publishedAt: '2021-01-01T00:00:00Z' }, statistics: { hiddenSubscriberCount: true, subscriberCount: '0', videoCount: '3' } },
      { id: 'c3', snippet: { title: 'Sahte Kanal 3' }, statistics: {} }
    ]
  };
  const { client } = setup({ fetchImpl: async () => new Response(JSON.stringify(body)) });
  const [c1, c2, c3] = await client.channels(['c1', 'c2', 'c3']);
  assert.deepEqual(c1, { id: 'c1', title: 'Sahte Kanal 1', publishedAt: '2020-01-01T00:00:00Z', subscriberCount: 1500, videoCount: 40 });
  assert.equal(c2.subscriberCount, null);
  assert.equal(c2.videoCount, 3);
  assert.deepEqual(c3, { id: 'c3', title: 'Sahte Kanal 3', publishedAt: null, subscriberCount: null, videoCount: null });
});

test('sahte fetch yanıtı gerçek biçimde eşlenir (P0D canlı, gizli abone)', async () => {
  const fake = createFakeFetch({ nowMs: NOW });
  const { client } = setup({ fetchImpl: fake });
  const vids = await client.videos(['Sahtetr_canli', 'Sahtetr_yaklasan', 'Sahtetr00_0']);
  assert.ok(vids.some((v) => v.liveBroadcastContent === 'live' && v.durationSec === 0));
  const chs = await client.channels(['UCSahtetr11', 'UCSahtetr13']);
  assert.equal(chs.length, 1); // 13. kanal yanıtta yok
  assert.equal(chs[0].subscriberCount, null);
});
