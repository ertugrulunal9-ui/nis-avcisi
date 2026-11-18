import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggest } from '../src/suggest.mjs';
import { createFakeFetch } from './helpers/fake-fetch.mjs';

// ISO-8859-9: ş=0xFE ğ=0xF0 ı=0xFD
function latin5(text) {
  const map = { 'ş': 0xfe, 'ğ': 0xf0, 'ı': 0xfd, 'ö': 0xf6, 'ü': 0xfc, 'ç': 0xe7, 'İ': 0xdd };
  return Uint8Array.from([...text].map((c) => map[c] ?? c.charCodeAt(0)));
}

test('ISO-8859-9 gövde doğru çözülür', async () => {
  const body = latin5('["osmanlı",["osmanlı kuruluşu","şu ğ ı"]]');
  const f = async () => new Response(body, { headers: { 'content-type': 'text/javascript; charset=ISO-8859-9' } });
  assert.deepEqual(await suggest('osmanlı', 'tr', { fetchImpl: f, regionCode: 'TR' }), ['osmanlı kuruluşu', 'şu ğ ı']);
});

test('UTF-8 gövde (charset yok) doğru çözülür', async () => {
  const body = new TextEncoder().encode('["x",["şu ğ ı"]]');
  const f = async () => new Response(body, { headers: { 'content-type': 'application/json' } });
  assert.deepEqual(await suggest('x', 'tr', { fetchImpl: f, regionCode: 'TR' }), ['şu ğ ı']);
});

test('URL parametreleri ve anahtarsız istek', async () => {
  const fake = createFakeFetch({ nowMs: Date.now() });
  const list = await suggest('tarih belgeseli', 'tr', { fetchImpl: fake, regionCode: 'TR' });
  assert.ok(list.includes('tarih belgeseli özet'));
  assert.ok(list.some((x) => x.includes('şu ğ ı')));
  const req = fake.requests[0];
  const u = new URL(req.url);
  assert.equal(u.hostname, 'suggestqueries.google.com');
  assert.equal(u.searchParams.get('client'), 'firefox');
  assert.equal(u.searchParams.get('ds'), 'yt');
  assert.equal(u.searchParams.get('hl'), 'tr');
  assert.equal(u.searchParams.get('gl'), 'TR');
  assert.equal(u.searchParams.get('q'), 'tarih belgeseli');
  assert.equal(req.headers['x-goog-api-key'], undefined);
  assert.equal(u.searchParams.has('key'), false);
});

test('HTTP hatası fırlatır', async () => {
  const f = async () => new Response('x', { status: 500 });
  await assert.rejects(() => suggest('x', 'tr', { fetchImpl: f }), /HTTP 500/);
});
