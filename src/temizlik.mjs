import fs from 'node:fs';
import path from 'node:path';

const GUN_MS = 24 * 60 * 60 * 1000;

// out/ altındaki saklama süresini aşan koşu klasörlerini siler; silinen sayısını döndürür.
export function purgeOutputs(outDir, nowMs, saklamaGun) {
  let entries;
  try {
    entries = fs.readdirSync(outDir, { withFileTypes: true });
  } catch {
    return 0;
  }
  let silinen = 0;
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(outDir, e.name);
    let created = null;
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
      const t = Date.parse(meta.createdAt);
      if (Number.isFinite(t)) created = t;
    } catch { /* meta yok ya da bozuk: mtime'a düş */ }
    if (created === null) {
      try { created = fs.statSync(dir).mtimeMs; } catch { continue; }
    }
    if (nowMs - created > saklamaGun * GUN_MS) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        silinen++;
      } catch { /* silinemeyen klasör bir sonraki komutta yeniden denenir */ }
    }
  }
  return silinen;
}

const istanbulFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Istanbul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

// 'YYYY-MM-DD-HHmm' (İstanbul saati)
export function makeRunId(nowMs) {
  const p = Object.fromEntries(istanbulFmt.formatToParts(new Date(nowMs)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}`;
}

// out/<runId><sonek> klasörünü oluşturur; varsa <runId>-2<sonek>, -3 ... dener.
export function claimRunDir(outDir, runId, sonek = '') {
  fs.mkdirSync(outDir, { recursive: true });
  for (let i = 1; i < 1000; i++) {
    const id = i === 1 ? runId : `${runId}-${i}`;
    const dir = path.join(outDir, `${id}${sonek}`);
    try {
      fs.mkdirSync(dir);
      return { runId: id, dir };
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
    }
  }
  throw new Error('Koşu klasörü oluşturulamadı');
}
