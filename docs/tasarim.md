# Niş Avcısı: tasarım v2 (2026-11-18)

v1 iki taze göz incelemesinden (sadelik + mimari) sonra yeniden yazıldı. Değişenler en altta.

## Amaç
Yapay zekâ ile YouTube içeriği üretecek kullanıcıya "hangi nişe girmeli" sorusunu veriyle yanıtlamak: aynı nişi **Türkçe ve İngilizce**, **uzun video ve kısa video** olarak ölçmek. Ücretli NexLev/1of10/vidIQ'nun çekirdek sinyalini (küçük/yeni kanalın büyük izlenme alması, birden çok kanalda) ücretsiz YouTube Data API ile yerelde üretmek.

## Kullanım
Kullanıcı komut yazmaz. Bir Claude oturumunda "niş tara" der; Claude `.claude/skills/nis-tara/SKILL.md`'yi izler: `durum` → `tara` (ya da önce `kesfet`) → `out/<koşu>/rapor.md` + `rapor.json` + `kapaklar/` → Claude Türkçe özet yazar.

## Doğrulanmış kısıtlar (kaynak: docs/arastirma-2026-11-18.md)
- Kota: günde 100 `search.list` (ayrı kova), diğer uçlar 10.000 birim. Sıfırlama Pasifik gece yarısı. Darboğaz arama: **günde bir tam tarama**.
- Saklama: API'den gelen her şey 30 gün içinde silinir. Araçta kalıcı veritabanı yok; tek kalıcı durum kota sayacı (`data/kota.json`, API verisi içermez) ve `out/<koşu>/` klasörleri (30 günde silinir).
- Türetilmiş metrik (oran, medyan, günlük izlenme, puan, gelir tahmini) yalnız `config/ayarlar.json` içinde `turetilmisMetrikEkiKabulEdildi: true` iken hesaplanır. **v1'in asıl cevabı bu eki gerektirir.** `false` iken **ham mod**: hücre başına yalnız API alanlarından oluşan bir tablo; sıralama yok, oran yok, kapak yok. Claude da ham modda oran hesaplamaz, niş sıralamaz.
- Raporda türetilmiş her sayı "bu aracın hesabı, YouTube verisi değil", gelir tahmini "üçüncü taraf RPM tahmini, YouTube verisi değil" diye etiketlenir.
- API anahtarı yalnız `googleapis.com` isteklerine `X-Goog-Api-Key` başlığıyla gider; URL'de, logda, hata mesajında, raporda asla görünmez. Kapak ve öneri istekleri anahtarsız düz `fetch` ile yapılır.

## Yığın
Node 24, **bağımlılıksız** (yerleşik `fetch`, `node:test`, `node:fs`). ESM. Windows'ta çalışır; yollar `path.join`. Zaman her yerde **milisaniye sayı** (`nowMs`); yalnız `createQuota` bir `nowFn: () => number` alır. `log` her yerde `(mesaj: string) => void`.

## Dosyalar ve sahiplik
```
config/ayarlar.json  config/nisler.json  config/rpm.json  config/platformlar.json   (elle yazıldı; ajanlar değiştirmez)
src/errors.mjs     QuotaExceededError, ApiKeyError, ApiError                     [B]
src/env.mjs        .env okur                                                     [B]
src/quota.mjs      Pasifik günü + kota sayacı (JSON dosyası)                     [B]
src/youtube.mjs    API istemcisi + yanıt eşleme + parseIsoDuration                [B]
src/suggest.mjs    YouTube arama önerisi (anahtarsız)                            [B]
src/temizlik.mjs   30 günden eski out/ klasörlerini siler                        [B]
src/tara.mjs       tarama akışı                                                  [B]
src/kesfet.mjs     keşif akışı                                                   [B]
src/cli.mjs        komutlar: durum, tara, kesfet                                 [B]
src/metrics.mjs    saf fonksiyonlar                                              [A]
src/report.mjs     saf fonksiyon: rapor markdown + json                          [A]
test/helpers/fake-fetch.mjs  API biçiminde sahte yanıtlar                        [B]
test/ornek-rapor.mjs         sahte veriyle örnek rapor üretir (inceleme için)    [B]
test/*.test.mjs              node:test, ağa çıkmaz                              [A: metrics, report; B: diğerleri]
```

## Veri biçimleri (A ile B arasındaki sözleşme)
```js
// Video: youtube.mjs eşler
{ id, title, channelId, channelTitle, publishedAt /*ISO*/, durationSec /*number|null*/, viewCount /*number|null*/,
  thumbnailUrl /*string|null*/, language /*'tr'|'en'|... birincil alt etiket, küçük harf; yoksa ya da 'und'/'zxx' ise null*/,
  liveBroadcastContent /*'none'|'live'|'upcoming'*/ }
// Channel: youtube.mjs eşler
{ id, title, publishedAt /*ISO|null*/, subscriberCount /*number|null; hiddenSubscriberCount ise null*/, videoCount /*number|null*/ }
// Row
{ video, channel /*Channel|null*/, m /*videoMetrics çıktısı; ham modda null*/ }
// s = config/ayarlar.json'un ayrıştırılmış hali; rpm = config/rpm.json
```

### src/metrics.mjs [A] (saf; I/O yok)
```js
export function median(nums)  // number[] → number|null; null/NaN atlanır; boşsa null; çift sayıda ortadaki ikisinin ortalaması
export function classifyFormat(durationSec, s) // ≥ s.uzunMinSaniye → 'uzun'; 1..s.kisaMaxSaniye → 'kisa'; diğer (null, 0, arada) → null
export function isSmallOrNew(channel, lang, nowMs, s)
  // channel null → false. (subscriberCount != null && subscriberCount ≤ s.esik[lang].kucukKanalAbone)
  //   || (publishedAt != null && kanal yaşı (gün) ≤ s.esik[lang].yeniKanalGun)
export function videoMetrics(video, channel, lang, nowMs, s)
  // → { ageDays /*en az 1*/, viewsPerDay /*viewCount/ageDays; viewCount null → null*/,
  //     oran /*viewCount / max(subscriberCount, s.esik[lang].aboneTabani); abone ya da izlenme null → null*/,
  //     channelAgeDays /*null olabilir*/, smallOrNew }
export function minIzlenme(lang, format, s) // s.esik[lang].minIzlenme × (format==='kisa' ? s.kisaCarpani.minIzlenme : 1)
export function nicheMetrics(rows, lang, format, s)
  // rows: m dolu satırlar (tara format filtresini ve kanal başına sınırı uygulamış olarak verir)
  // → { n /*rows.length*/, kanalSayisi /*farklı channelId*/,
  //     medianViews, medianViewsPerDay /*n=0 → null*/,
  //     firsatKanallari: [{ channelId, channelTitle, subscriberCount, channelAgeDays, videoId, title, viewCount, oran }],
  //        // m.smallOrNew && m.oran ≥ s.esik[lang].oran && viewCount ≥ minIzlenme(lang, format, s); kanal başına en yüksek oranlı video; orana göre azalan
  //     buyukKanalPayi /*abonesi bilinen kanallı satırlarda abone ≥ s.esik[lang].buyukKanalAbone oranı; payda 0 → null*/,
  //     gizliAboneOrani /*kanalı olan satırlarda subscriberCount null oranı; payda 0 → null*/ }
export function rpmLookup(rpm, kategori, lang, format) // uzun → rpm.uzun[lang][kategori]; kisa → rpm.kisa[lang]['*']; yoksa null. Yalnız uzun/kisa anahtarlarına bakar
export function maxRpmMid(rpm, lang, format)           // o dil+formattaki bantların (min+max)/2 en büyüğü; yoksa null
export function aylikTahmin(medianViewsPerDay, rpmBand) // → [vpd×30×min/1000, vpd×30×max/1000] USD, 2 ondalık; biri null → null
export function nicheScore(metrics, rpmBand, maxMid, lang, format, s)
  // metrics.n === 0 → null.
  // → { puan /*0..100 tam sayı*/, parcalar: { firsat, talep, acik, para } /*0..100 tam sayı*/, uyarilar: string[], siralamaDisi: boolean }
```
Puan (yalnız **aynı dil + format** içindeki nişleri sıralamak için; gruplar arası karşılaştırmada kullanılmaz):
- `k = firsatKanallari.length`; `firsat = k ≥ s.firsatMinKanal ? min(100, 25 × k) : 0`
- `talep = clamp0..100(100 × log10(1 + medianViewsPerDay) / log10(1 + ref))`, `ref = s.esik[lang].referansGunlukIzlenme × (kisa ? s.kisaCarpani.referansGunlukIzlenme : 1)`
- `acik = buyukKanalPayi == null ? 50 : 100 × (1 − buyukKanalPayi)`
- `para = (rpmBand && maxMid) ? 100 × ln(1 + orta) / ln(1 + maxMid) : 0`, `orta = (min+max)/2`
- `puan = round(Σ s.agirlik[parça] × parça)`
- Uyarılar (sırayla, Türkçe): `n < s.minOrnek` → "yetersiz örnek (n=…)" ve `siralamaDisi = true`; `k === 1` → "tek fırsat kanalı; şans olabilir"; `gizliAboneOrani > 0.3` → "kanalların çoğu abone sayısını gizliyor"; `buyukKanalPayi == null` → "abone verisi yok"; `rpmBand == null` → "RPM bandı yok".

### src/report.mjs [A] (saf; I/O yok)
```js
export function buildReport(runData, s) // → { markdown: string, json: object /*runData'nın derin kopyası*/ }
```
`runData` (B üretir):
```js
{ runId, createdAt /*ISO*/, finishedAt /*ISO*/, derivedMetrics /*bool*/,
  quota: { day, searchUsed, unitsUsed, searchLimit /*= kota.aramaPayi*/, unitsLimit /*= kota.birimPayi*/, stoppedEarly, stopReason /*string|null*/ },
  params: { langs, formats, days },
  niches: [{ id, etiket, kategori,
    cells: [{ lang, format, queries /*string[]*/, rows /*Row[]*/,
              metrics /*nicheMetrics|null*/, score /*nicheScore|null*/, rpmBand /*[min,max]|null*/, aylikTahmin /*[lo,hi]|null*/,
              error /*string|null: 'kota', 'uygun video yok', ya da hata mesajı*/ }] }] }
```
Markdown (Türkçe), sırayla:
1. **Başlık**: koşu kimliği, tarih, mod (`türetilmiş` / `ham`), kota (`arama x/searchLimit`, `birim y/unitsLimit`), erken durduysa neden, hatalı hücre sayısı.
2. Türetilmiş modda **Karşılaştırma (mutlak sayılar)**: satır = niş × dil; sütunlar: uzun (medyan günlük izlenme, fırsat `k/kanalSayisi`, aylık tahmin $) ve kısa (aynı üçü). Boş/hatalı hücre "—".
3. Türetilmiş modda **Sıralama**: her (dil, format) grubu için ayrı tablo; `siralamaDisi` olmayanlar puana göre azalan: puan, parçalar (f/t/a/p), fırsat k/kanalSayisi, medyan günlük izlenme, büyük kanal payı (%), RPM bandı, n, uyarılar. Altında "Sıralama dışı (yetersiz örnek)" listesi.
4. Türetilmiş modda **Fırsat kanalları**: her grubun ilk 3 nişi için `firsatKanallari` (kanal, abone, kanal yaşı gün, video başlığı, izlenme, oran, `https://www.youtube.com/watch?v=<id>`).
5. Ham modda **Ham veri**: her hücre için izlenmeye göre azalan ilk 15 satır: başlık, kanal, izlenme, yayın tarihi (YYYY-AA-GG), abone (gizliyse "gizli"), kanal açılış tarihi, link. Ham modda bölüm 2–4 yok; "puan", "oran", "medyan" kelimeleri ve türetilmiş sayı bölüm 1–5'te geçmez.
6. **Yöntem ve etiketler** (iki modda): formüller ve eşikler; "Oran, medyan, günlük izlenme, puan ve gelir tahmini bu aracın hesabıdır, YouTube verisi değildir."; "Gelir tahmini üçüncü taraf RPM tahminidir (config/rpm.json), YouTube verisi değildir."; "Kısa = ≤ s.kisaMaxSaniye sn video; dikey Shorts olduğu doğrulanamaz."; "Puan yalnız aynı dil ve formattaki nişleri sıralar." Ham modda: neden puan olmadığı + ek kabul yolu (https://support.google.com/youtube/contact/yt_api_form → Section 5 → Analytics & Reporting).

## Akış: tara (src/tara.mjs) [B]
```js
export async function runScan({ nicheIds /*null=hepsi*/, langs, formats, days, nowMs, rootDir, apiKey, fetchImpl, sleep, log })
  // → { runId, outPath, quota /*status()*/, exitCode /*0|1|2*/ }
  // config: <rootDir>/config, kota: <rootDir>/data/kota.json, çıktı: <rootDir>/out
```
1. Ayarları, nişleri, rpm'i oku. `createQuota`, `createClient`.
2. Her niş → her dil (bir **hücre grubu**):
   - `queries = nis[lang]` (dizi; 1–3 ifade). Her ifade için `client.search({ q, lang, regionCode: s.arama.bolge[lang], publishedAfter: nowMs − days gün, maxResults: 50 })` (süre filtresi yok, `order=relevance`, `type=video`, `relevanceLanguage=lang`). Bir ifade hata verirse diğerleri sürer.
   - Kimlikleri tekilleştir → `client.videos(ids)` → `liveBroadcastContent !== 'none'` olanları at → `video.language` doluysa ve `lang`'den farklıysa at.
   - `client.channels(farklı channelId)`; dönmeyen kanal → `channel: null`.
   - Kanal başına en çok `s.kanalBasinaMaxVideo` video (izlenmeye göre en yüksekler) bırak.
   - İstenen her format için: `classifyFormat` ile süz → satırlar. Türetilmiş modda her satıra `m = videoMetrics(...)`, sonra `metrics = nicheMetrics`, `rpmBand = rpmLookup`, `score = nicheScore(metrics, rpmBand, maxRpmMid(rpm, lang, format), ...)`, `aylikTahmin = aylikTahmin(metrics.medianViewsPerDay, rpmBand)`. Ham modda `m/metrics/score/rpmBand/aylikTahmin = null`. Satır yoksa `error: 'uygun video yok'`.
3. Kota: tara ayrıca "pay doldu mu" kontrol etmez; yalnız `QuotaExceededError` yakalar. Yakalanınca o hücre ve kalan tüm hücreler `error: 'kota'`, `stoppedEarly = true`, `stopReason` = `source` ('yerel' pay doldu / 'google' Google reddetti), rapor yine yazılır, `exitCode 0`. `ApiKeyError` → tarama durur, rapor yazılmaz, Türkçe kurulum mesajı loglanır, `exitCode 2`. Diğer hatalar yalnız o hücreyi `error: mesaj` yapar.
4. `runId` = İstanbul saatiyle `YYYY-MM-DD-HHmm` (`Intl.DateTimeFormat`, `Europe/Istanbul`); klasör varsa `-2`, `-3`. `out/<runId>/rapor.md`, `rapor.json`, `meta.json` `{ createdAt }`.
5. Türetilmiş modda kapaklar: tüm hücrelerin `firsatKanallari`ndan orana göre en iyi 12 video → `out/<runId>/kapaklar/<videoId>.jpg` (satırdaki `thumbnailUrl`, anahtarsız düz fetch). İndirme hatası raporu bozmaz. Ham modda kapak yok.
6. Log: rapor yolu, kota kullanımı, durduysa nedeni.

## src/youtube.mjs [B]
```js
export function parseIsoDuration(str)   // 'PT1H2M3S' → 3723; 'P1DT2H' → 93600; 'P0D' → 0; geçersiz/null → null
export function createClient({ apiKey, fetchImpl = fetch, quota, sleep, log })
// client.search({ q, lang, regionCode, publishedAfter, maxResults }) → videoId[]   // deneme başına quota.useSearch(1)
// client.videos(ids)   → Video[]    // 50'li partiler; parti başına (deneme başına) quota.useUnits(1); part=snippet,statistics,contentDetails
// client.channels(ids) → Channel[]  // aynı; part=snippet,statistics
```
- Taban `https://www.googleapis.com/youtube/v3/`; anahtar `X-Goog-Api-Key` başlığında; `AbortSignal.timeout(15000)`.
- `publishedAfter` saniye hassasiyetinde RFC 3339 (`...T22:13:20Z`, milisaniyesiz). `videos`/`channels` isteklerine `maxResults` eklenmez (YouTube belgesi: `id` ile birlikte desteklenmiyor).
- Kota **her HTTP denemesinden önce** sayılır (yeniden denemeler dahil; başarısız istek de kotadan yer).
- Yeniden deneme: ağ hatası, zaman aşımı, 5xx, 429, `rateLimitExceeded`/`userRateLimitExceeded` → en çok 2 kez (`sleep(1000)`, `sleep(3000)`; testte `sleep` enjekte edilir).
- Hata nedeni: `error.errors[0].reason` **ve** `error.details[].reason` (ikisine de bak). `quotaExceeded`/`dailyLimitExceeded` → `quota.markExhausted(bucket)` + `QuotaExceededError('google', bucket)`. `keyInvalid`, `API_KEY_INVALID`, `accessNotConfigured`, `SERVICE_DISABLED`, `API_KEY_SERVICE_BLOCKED`, `ipRefererBlocked`, `API_KEY_HTTP_REFERRER_BLOCKED`, `API_KEY_IP_ADDRESS_BLOCKED` → `ApiKeyError`. Diğer → `ApiError(status, reason, message)`. Hiçbir hata metninde URL ya da anahtar yok.
- Eşleme: `viewCount`/`subscriberCount`/`videoCount` dizeden sayıya (yoksa null); `hiddenSubscriberCount: true` → `subscriberCount: null`; `thumbnailUrl = thumbnails.medium?.url ?? thumbnails.default?.url ?? null`; `language` = `defaultAudioLanguage ?? defaultLanguage`'ın birincil alt etiketi.

## src/quota.mjs [B]
```js
export function pacificDay(nowMs) // 'YYYY-MM-DD', America/Los_Angeles
export function createQuota({ path, settings, nowFn })
// → { useSearch(n), useUnits(n), markExhausted(bucket /*'search'|'units'*/), status() }
// status() → { day, searchUsed, unitsUsed, searchLimit: kota.aramaPayi, unitsLimit: kota.birimPayi, searchLeft, unitsLeft }
```
JSON dosyası `{ day, searchUsed, unitsUsed }`; gün değişince sıfırlanır. `used + n > limit` ise `QuotaExceededError('yerel', bucket)` atar, saymaz. `markExhausted` sayacı limite eşitler (o Pasifik gününde başka istek gitmez). Her değişiklikte dosyaya yazar.

## src/errors.mjs [B]
`QuotaExceededError(source, bucket)`, `ApiKeyError(reason)`, `ApiError(status, reason, message)`; hepsi `Error`'dan türer, `name` alanı dolu.

## src/env.mjs [B]
`loadEnv(rootDir) → { apiKey: string|null }`. `.env`'i okur: BOM'u ve `\r`'yi atar, `#` yorumları ve boş satırları geçer, değerin çevresindeki tırnakları kaldırır; `process.env.YT_API_KEY` doluysa o önceliklidir. Boş değer → null. Hiçbir şey loglamaz.

## src/temizlik.mjs [B]
`purgeOutputs(outDir, nowMs, saklamaGun) → number` (silinen klasör sayısı). Yaş `meta.json.createdAt`'ten, yoksa klasörün `mtime`'ından. `out/` yoksa 0.

## src/suggest.mjs + src/kesfet.mjs [B]
```js
export async function suggest(q, lang, { fetchImpl, regionCode }) // → string[]
// GET https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=<lang>&gl=<regionCode>&ie=utf-8&oe=utf-8&q=<q>
// yanıt: [q, [öneri, ...]]. Gövdeyi arrayBuffer olarak al; Content-Type'taki charset'le (yoksa utf-8) TextDecoder ile çöz.
export async function runDiscover({ seeds, langs, nowMs, rootDir, fetchImpl, sleep, log }) // → { outPath }
```
Her tohum × dil × `s.kesif.ekler[lang]` için bir istek, aralarda `sleep(s.kesif.beklemeMs)`. Tohumun kendisi ve tekrarlar çıkarılır. Çıktı `out/<runId>-kesif/kesif.md` + `kesif.json` + `meta.json`. YouTube API kotası harcamaz; anahtar gönderilmez.

## src/cli.mjs [B]
```
node src/cli.mjs durum                                        # anahtar var/yok (değer ya da uzunluk asla), mod, bugünkü kota (Pasifik günü), Node sürümü
node src/cli.mjs tara [--nisler a,b] [--dil tr,en] [--format uzun,kisa] [--gun 180]
node src/cli.mjs kesfet "<tohum>" ["<tohum>" ...] [--dil tr,en]
```
Her komut başında `purgeOutputs` çalışır. Bilinmeyen niş kimliği → hata, çıkış 1. Anahtar yoksa `tara` Türkçe kurulum adımlarını yazar (README "Kurulum"), çıkış 2. Çıkış kodları: 0 başarı (erken durma dahil), 1 hata, 2 kurulum eksik/anahtar geçersiz.

## Testler (node:test, ağsız)
- [A] metrics: medyan (tek/çift/null), format sınırları (179/180/181/239/240, 0, null), isSmallOrNew (null kanal, gizli abone + yeni kanal), oran tabanı, fırsat kuralları (kanal başına tek, eşikler, `firsatMinKanal`), paylar ve null paydalar, rpmLookup (uzun/kisa/'*'/eksik kategori), maxRpmMid, aylikTahmin, puan sınırları, n=0 → null, uyarı metinleri, siralamaDisi.
- [A] report: ham modda bölüm 1–5'te "puan", "oran", "medyan" geçmez ve json'da `m/metrics/score` null; türetilmiş modda bölüm başlıkları ve etiket cümleleri var; erken durma nedeni başlıkta; "—" boş hücre.
- [B] youtube: anahtar başlıkta, URL'de yok; hata mesajında anahtar yok; deneme başına kota; 429 → yeniden deneme; `error.details[].reason` = `API_KEY_INVALID` → ApiKeyError; quotaExceeded → markExhausted + QuotaExceededError('google'); parseIsoDuration; eşleme (gizli abone, eksik izlenme, P0D, dil etiketi).
- [B] quota: Pasifik gün sınırı (kışın UTC 07:59 vs 08:00), pay aşımı saymaz, markExhausted, gün dönümünde sıfırlama.
- [B] env: BOM + CRLF + tırnak; boş değer null.
- [B] suggest: ISO-8859-9 ve UTF-8 gövdede "ş, ğ, ı" doğru; kapak/öneri isteklerinde anahtar başlığı yok.
- [B] temizlik: meta.json'a göre 31 gün sil, 29 gün tut; meta yoksa mtime.
- [B] tara uçtan uca (`test/helpers/fake-fetch.mjs`, geçici rootDir): türetilmiş modda rapor.md/json yazılır, en az bir hücrede `firsatKanallari.length ≥ 2` ve puan dolu; ham modda puan yok ve kapak yok; arama payı 3 iken erken durur, rapor yine yazılır, kalan hücreler `error: 'kota'`; canlı yayın ve yanlış dildeki video elenir; kanal başına sınır uygulanır.
- `test/helpers/fake-fetch.mjs`: `createFakeFetch({ nowMs, errors })` gerçek API biçiminde JSON döndürür (search, videos, channels); kanal istatistikleri channelId'den tohumlanır (her sorguda aynı); küçük/yeni kanallar, büyük kanallar, gizli abone, `P0D` canlı yayın, yanlış dilde video, uzun ve kısa süreler içerir; `errors` ile belirli yollara 403/429/500 enjekte edilir; çağrıları yol bazında sayar (`fake.calls`).
- `test/ornek-rapor.mjs <hedefKlasör>`: sahte fetch ile türetilmiş modda bir tarama çalıştırıp raporu yazar (gerçek kota dosyasına dokunmaz).

## Kapsam dışı (v1)
Web paneli, zamanlanmış koşu, kalıcı veritabanı ve önceki koşuyla fark, kanal yükleme geçmişinden outlier (playlistItems), TikTok/Instagram verisi, Wikipedia/Trends sinyali, otomatik "yüzsüz" sınıflama (Claude kapaklara bakar).

## v1 → v2 değişiklikleri (incelemelerden)
- Karşılaştırma mutlak sayılarla (medyan günlük izlenme, fırsat k/n, aylık tahmin); puan yalnız grup içi sıralama. Sebep: puan dil/format başına farklı ölçekleniyordu.
- `videoDuration=medium` kalktı: 20 dk üstü belgeseller hiç gelmiyordu. Süre filtresiz arama, yerelde ayrım; niş başına dil başına 2 ifade.
- Fırsat ölçüsü kanal medyanı yerine izlenme/abone oranı: baseline pahalıydı ve yeni kanalları (asıl hedef) eliyordu.
- `aciklik = 1 − top3Pay` yerine `1 − büyük kanal payı` (eskisi küçük kanalın viral videosunu cezalandırıyordu); `tekrarKanalSayisi` silindi; fırsat en az 2 kanalla puanlanır; yetersiz örnek sıralama dışı.
- Yanlış dildeki ve canlı/yaklaşan videolar elenir; kanal başına en çok 3 video.
- SQLite, önbellek, önceki puan, 36 ay dalı, `kota`/`temizle` komutları ve üründeki sahte mod çıktı; sahte veri yalnız testlerde.
- Kota her HTTP denemesinde sayılır; Google reddederse sayaç limite çekilir; hata nedeni `details[]`'te de aranır; 429 yeniden denenir; 15 sn zaman aşımı; temizlik her komutta.
- Kesif kaldı (kullanıcının "fikri veriden çıkar" kuralı: alt nişler YouTube önerilerinden gelir).
