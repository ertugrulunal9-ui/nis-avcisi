import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { KURULUM_MESAJI } from './errors.mjs';
import { loadEnv } from './env.mjs';
import { createQuota } from './quota.mjs';
import { purgeOutputs } from './temizlik.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GECERLI_DIL = ['tr', 'en'];
const GECERLI_FORMAT = ['uzun', 'kisa'];
const DEFAULT_SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

const KULLANIM = [
  'Kullanım:',
  '  node src/cli.mjs durum',
  '  node src/cli.mjs tara [--nisler a,b] [--dil tr,en] [--format uzun,kisa] [--gun 180]',
  '  node src/cli.mjs kesfet "<tohum>" ["<tohum>" ...] [--dil tr,en]'
].join('\n');

const FLAGS = {
  durum: [],
  tara: ['nisler', 'dil', 'format', 'gun'],
  kesfet: ['dil']
};

function parseArgs(argv, allowed) {
  const flags = {};
  const pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { pos.push(a); continue; }
    let name = a.slice(2);
    let value;
    const eq = name.indexOf('=');
    if (eq >= 0) {
      value = name.slice(eq + 1);
      name = name.slice(0, eq);
    } else {
      value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) throw new Error(`--${name} için değer gerekli`);
      i++;
    }
    if (!allowed.includes(name)) throw new Error(`Bilinmeyen seçenek: --${name}`);
    flags[name] = value;
  }
  return { flags, pos };
}

function csv(v, gecerli, ad) {
  if (v === undefined) return null;
  const list = v.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  const kotu = list.filter((x) => !gecerli.includes(x));
  if (list.length === 0 || kotu.length) throw new Error(`Geçersiz ${ad}: ${kotu.join(', ') || '(boş)'}. Geçerli: ${gecerli.join(', ')}`);
  return [...new Set(list)];
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
}

// Çıkış kodunu döndürür: 0 başarı, 1 hata, 2 kurulum eksik/anahtar geçersiz.
export async function main(argv, deps = {}) {
  const rootDir = deps.rootDir ?? ROOT;
  const out = deps.log ?? ((m) => console.log(m));
  const err = deps.err ?? ((m) => console.error(m));
  const nowMs = deps.nowMs ?? Date.now();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? DEFAULT_SLEEP;

  const [cmd, ...rest] = argv;
  if (!cmd || !(cmd in FLAGS)) {
    err(cmd ? `Bilinmeyen komut: ${cmd}\n${KULLANIM}` : KULLANIM);
    return 1;
  }

  try {
    const s = readJson(path.join(rootDir, 'config', 'ayarlar.json'));
    const silinen = purgeOutputs(path.join(rootDir, 'out'), nowMs, s.saklamaGun);
    if (silinen > 0) out(`Temizlik: ${silinen} eski koşu klasörü silindi (${s.saklamaGun} günden eski).`);

    const { flags, pos } = parseArgs(rest, FLAGS[cmd]);

    if (cmd === 'durum') {
      const { apiKey } = loadEnv(rootDir);
      const q = createQuota({ path: path.join(rootDir, 'data', 'kota.json'), settings: s, nowFn: () => nowMs }).status();
      out(`API anahtarı: ${apiKey ? 'var' : 'anahtar yok'}`);
      out(`Mod: ${s.turetilmisMetrikEkiKabulEdildi === true ? 'türetilmiş metrikler açık' : 'ham mod (türetilmiş metrik eki kabul edilmedi)'}`);
      out(`Kota (Pasifik günü ${q.day}): arama ${q.searchUsed}/${q.searchLimit}, birim ${q.unitsUsed}/${q.unitsLimit}`);
      out(`Node: ${process.version}`);
      return 0;
    }

    if (cmd === 'tara') {
      if (pos.length) throw new Error(`Beklenmeyen argüman: ${pos.join(' ')}`);
      const nisler = readJson(path.join(rootDir, 'config', 'nisler.json')).nisler;
      let nicheIds = null;
      if (flags.nisler !== undefined) {
        nicheIds = [...new Set(flags.nisler.split(',').map((x) => x.trim()).filter(Boolean))];
        const bilinmeyen = nicheIds.filter((id) => !nisler.some((n) => n.id === id));
        if (nicheIds.length === 0 || bilinmeyen.length) {
          err(`Bilinmeyen niş kimliği: ${bilinmeyen.join(', ') || '(boş)'}\nGeçerli kimlikler: ${nisler.map((n) => n.id).join(', ')}`);
          return 1;
        }
      }
      const langs = csv(flags.dil, GECERLI_DIL, 'dil');
      const formats = csv(flags.format, GECERLI_FORMAT, 'format');
      let days = null;
      if (flags.gun !== undefined) {
        days = Number(flags.gun);
        if (!Number.isInteger(days) || days < 1 || days > 3650) throw new Error(`Geçersiz --gun: ${flags.gun}`);
      }

      const { apiKey } = loadEnv(rootDir);
      if (!apiKey) {
        err(KURULUM_MESAJI);
        return 2;
      }
      const { runScan } = await import('./tara.mjs');
      const r = await runScan({ nicheIds, langs, formats, days, nowMs, rootDir, apiKey, fetchImpl, sleep, log: out });
      if (r.exitCode === 2) err(KURULUM_MESAJI);
      return r.exitCode;
    }

    // kesfet
    if (pos.length === 0) throw new Error('En az bir tohum gerekli: node src/cli.mjs kesfet "<tohum>"');
    const langs = csv(flags.dil, GECERLI_DIL, 'dil');
    const { runDiscover } = await import('./kesfet.mjs');
    await runDiscover({ seeds: pos, langs, nowMs, rootDir, fetchImpl, sleep, log: out });
    return 0;
  } catch (e) {
    err(`Hata: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
