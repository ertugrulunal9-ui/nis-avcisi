import fs from 'node:fs';
import path from 'node:path';
import { QuotaExceededError } from './errors.mjs';

const pacificFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export function pacificDay(nowMs) {
  const p = Object.fromEntries(pacificFmt.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function validState(o) {
  return o && typeof o.day === 'string'
    && Number.isFinite(o.searchUsed) && o.searchUsed >= 0
    && Number.isFinite(o.unitsUsed) && o.unitsUsed >= 0;
}

export function createQuota({ path: file, settings, nowFn = () => Date.now() }) {
  const limits = { search: settings.kota.aramaPayi, units: settings.kota.birimPayi };

  function current() {
    const day = pacificDay(nowFn());
    try {
      const o = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (validState(o) && o.day === day) {
        return { day, searchUsed: o.searchUsed, unitsUsed: o.unitsUsed };
      }
    } catch { /* dosya yok ya da bozuk: sıfırdan başla */ }
    return { day, searchUsed: 0, unitsUsed: 0 };
  }

  function write(state) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(state));
  }

  function use(bucket, n) {
    const st = current();
    const key = bucket === 'search' ? 'searchUsed' : 'unitsUsed';
    if (st[key] + n > limits[bucket]) throw new QuotaExceededError('yerel', bucket);
    st[key] += n;
    write(st);
  }

  return {
    useSearch: (n) => use('search', n),
    useUnits: (n) => use('units', n),
    markExhausted(bucket) {
      const st = current();
      const key = bucket === 'search' ? 'searchUsed' : 'unitsUsed';
      st[key] = Math.max(st[key], limits[bucket]);
      write(st);
    },
    status() {
      const st = current();
      return {
        day: st.day,
        searchUsed: st.searchUsed,
        unitsUsed: st.unitsUsed,
        searchLimit: limits.search,
        unitsLimit: limits.units,
        searchLeft: Math.max(0, limits.search - st.searchUsed),
        unitsLeft: Math.max(0, limits.units - st.unitsUsed)
      };
    }
  };
}
