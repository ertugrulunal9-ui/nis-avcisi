import fs from 'node:fs';
import path from 'node:path';
import { suggest } from './suggest.mjs';
import { claimRunDir, makeRunId } from './temizlik.mjs';

const norm = (t) => t.trim().toLowerCase();

export async function runDiscover({ seeds, langs, nowMs, rootDir, fetchImpl, sleep, log = () => {} }) {
  const s = JSON.parse(fs.readFileSync(path.join(rootDir, 'config', 'ayarlar.json'), 'utf8').replace(/^﻿/, ''));
  langs = langs?.length ? langs : ['tr', 'en'];

  const results = [];
  let first = true;
  for (const seed of seeds) {
    for (const lang of langs) {
      const found = [];
      const seen = new Set([norm(seed)]);
      for (const ek of s.kesif.ekler[lang] ?? ['']) {
        if (!first) await sleep(s.kesif.beklemeMs);
        first = false;
        const q = `${seed}${ek}`;
        try {
          const list = await suggest(q, lang, { fetchImpl, regionCode: s.arama.bolge[lang] });
          for (const item of list) {
            const k = norm(item);
            if (!k || seen.has(k)) continue;
            seen.add(k);
            found.push(item);
          }
        } catch (e) {
          log(`Öneri alınamadı (${q}): ${e.message}`);
        }
      }
      results.push({ seed, lang, oneriler: found });
      log(`${seed} [${lang}]: ${found.length} öneri`);
    }
  }

  const claimed = claimRunDir(path.join(rootDir, 'out'), makeRunId(nowMs), '-kesif');
  const createdAt = new Date(nowMs).toISOString();
  const md = [
    `# Keşif: ${claimed.runId}`,
    '',
    `Tarih: ${createdAt}. Kaynak: YouTube arama önerileri (anahtarsız, API kotası harcamaz).`,
    "Öneriler yalnız fikir ipucudur; talep ya da rekabet ölçüsü değildir. Ölçmek için bir öneriyi config/nisler.json'a ekleyip tara.",
    ''
  ];
  for (const r of results) {
    md.push(`## ${r.seed} (${r.lang})`, '');
    if (r.oneriler.length === 0) md.push('Öneri yok.');
    else for (const o of r.oneriler) md.push(`- ${o}`);
    md.push('');
  }
  fs.writeFileSync(path.join(claimed.dir, 'kesif.md'), md.join('\n'));
  fs.writeFileSync(
    path.join(claimed.dir, 'kesif.json'),
    JSON.stringify({ runId: claimed.runId, createdAt, seeds, langs, results }, null, 2)
  );
  fs.writeFileSync(path.join(claimed.dir, 'meta.json'), JSON.stringify({ createdAt }));
  log(`Keşif raporu: ${path.join(claimed.dir, 'kesif.md')}`);
  return { outPath: claimed.dir };
}
