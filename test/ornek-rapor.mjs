// Kullanım: node test/ornek-rapor.mjs <hedefKlasör>
// Sahte fetch ile türetilmiş modda bir tarama çalıştırır ve raporu hedef klasöre yazar.
// Gerçek config, data/kota.json ve out/ klasörlerine dokunmaz; ağa çıkmaz.
import fs from 'node:fs';
import path from 'node:path';
import { runScan } from '../src/tara.mjs';
import { createFakeFetch, prepareRoot } from './helpers/fake-fetch.mjs';

const hedef = process.argv[2];
if (!hedef) {
  console.error('Kullanım: node test/ornek-rapor.mjs <hedefKlasör>');
  process.exit(1);
}
const target = path.resolve(hedef);
fs.mkdirSync(target, { recursive: true });
prepareRoot(target, { derived: true });

const nowMs = Date.now();
const result = await runScan({
  nicheIds: ['tarih-belgesel', 'osmanli', 'uzay'],
  langs: ['tr', 'en'],
  formats: ['uzun', 'kisa'],
  days: 180,
  nowMs,
  rootDir: target,
  apiKey: 'SAHTE-ANAHTAR',
  fetchImpl: createFakeFetch({ nowMs }),
  sleep: async () => {},
  log: (m) => console.log(m)
});
console.log(`Örnek rapor: ${result.outPath ? path.join(result.outPath, 'rapor.md') : '(yazılmadı)'}`);
process.exit(result.exitCode);
