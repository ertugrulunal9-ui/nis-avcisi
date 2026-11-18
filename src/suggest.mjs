const ENDPOINT = 'https://suggestqueries.google.com/complete/search';

function decodeBody(buf, contentType) {
  const m = /charset\s*=\s*"?([\w.:-]+)"?/i.exec(contentType || '');
  const label = m ? m[1] : 'utf-8';
  let dec;
  try {
    dec = new TextDecoder(label);
  } catch {
    dec = new TextDecoder('utf-8');
  }
  return dec.decode(buf);
}

// YouTube arama önerisi; anahtarsız düz istek (anahtar başlığı eklenmez).
export async function suggest(q, lang, { fetchImpl = fetch, regionCode } = {}) {
  const params = new URLSearchParams({
    client: 'firefox',
    ds: 'yt',
    hl: lang,
    gl: regionCode ?? '',
    ie: 'utf-8',
    oe: 'utf-8',
    q
  });
  const res = await fetchImpl(`${ENDPOINT}?${params.toString()}`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Öneri isteği başarısız (HTTP ${res.status})`);
  const buf = await res.arrayBuffer();
  const text = decodeBody(buf, res.headers.get('content-type'));
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data[1] : null;
  if (!Array.isArray(list)) return [];
  return list.map((x) => (Array.isArray(x) ? x[0] : x)).filter((x) => typeof x === 'string');
}
