import fs from 'node:fs';
import path from 'node:path';

function unquote(v) {
  if (v.length >= 2) {
    const a = v[0];
    const b = v[v.length - 1];
    if ((a === '"' || a === "'") && a === b) return v.slice(1, -1);
  }
  return v;
}

export function parseEnv(text) {
  const out = {};
  const clean = text.replace(/^﻿/, '');
  for (const raw of clean.split('\n')) {
    const line = raw.replace(/\r/g, '').trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    out[key] = unquote(line.slice(eq + 1).trim());
  }
  return out;
}

// Hiçbir şey loglamaz; değeri yalnız çağırana döndürür.
export function loadEnv(rootDir) {
  let fromFile = null;
  try {
    const text = fs.readFileSync(path.join(rootDir, '.env'), 'utf8');
    fromFile = parseEnv(text).YT_API_KEY || null;
  } catch {
    fromFile = null;
  }
  const fromProcess = (process.env.YT_API_KEY || '').trim();
  return { apiKey: fromProcess || fromFile || null };
}
