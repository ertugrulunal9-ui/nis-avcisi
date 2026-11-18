// Rapor üretimi (saf; I/O yok). Sözleşme: docs/tasarim.md

const DASH = '—';
const FORMAT_ADI = { uzun: 'uzun', kisa: 'kısa' };

function sayiMi(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

// 12345 -> "12.345" (Türkçe binlik ayracı)
function binlik(tamSayiStr) {
  return tamSayiStr.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function fmtInt(n) {
  if (!sayiMi(n)) return DASH;
  const r = Math.round(n);
  return (r < 0 ? '-' : '') + binlik(String(Math.abs(r)));
}

function fmtDec(n, basamak) {
  if (!sayiMi(n)) return DASH;
  const [t, o] = Math.abs(n).toFixed(basamak).split('.');
  return (n < 0 ? '-' : '') + binlik(t) + (o ? ',' + o : '');
}

// Günlük izlenme gibi küçük değerlerde 1 ondalık, diğerlerinde tam sayı
function fmtGunluk(n) {
  if (!sayiMi(n)) return DASH;
  return Math.abs(n) < 10 ? fmtDec(n, 1) : fmtInt(n);
}

function fmtUsd(n) {
  return sayiMi(n) ? '$' + fmtDec(n, 2) : DASH;
}

function fmtBand(band) {
  if (!Array.isArray(band)) return DASH;
  return `${fmtUsd(band[0])} – ${fmtUsd(band[1])}`;
}

function fmtPct(x) {
  return sayiMi(x) ? `%${Math.round(x * 100)}` : DASH;
}

function fmtOran(x) {
  return sayiMi(x) ? `${fmtDec(x, 1)}×` : DASH;
}

function fmtTarih(iso) {
  if (typeof iso !== 'string' || iso.length < 10) return DASH;
  return iso.slice(0, 10);
}

function esc(x) {
  if (x == null) return DASH;
  return String(x).replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
}

function tablo(basliklar, satirlar) {
  const out = [];
  out.push('| ' + basliklar.join(' | ') + ' |');
  out.push('| ' + basliklar.map(() => '---').join(' | ') + ' |');
  for (const s of satirlar) out.push('| ' + s.join(' | ') + ' |');
  return out.join('\n');
}

function link(videoId) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function kota(q) {
  if (!q) return DASH;
  return `arama ${q.searchUsed}/${q.searchLimit}, birim ${q.unitsUsed}/${q.unitsLimit}`;
}

function durmaNedeni(q) {
  if (!q || !q.stoppedEarly) return null;
  const k = q.stopReason;
  if (k === 'yerel') return 'yerel pay doldu (yerel)';
  if (k === 'google') return 'Google kotayı reddetti (google)';
  return k ? String(k) : 'bilinmiyor';
}

function hucreler(runData) {
  const out = [];
  for (const n of runData.niches ?? []) for (const c of n.cells ?? []) out.push({ niche: n, cell: c });
  return out;
}

function gruplar(runData) {
  const langs = runData.params?.langs;
  const formats = runData.params?.formats;
  if (Array.isArray(langs) && Array.isArray(formats)) {
    const out = [];
    for (const lang of langs) for (const format of formats) out.push({ lang, format });
    return out;
  }
  const gor = new Set();
  const out = [];
  for (const { cell } of hucreler(runData)) {
    const k = `${cell.lang}|${cell.format}`;
    if (!gor.has(k)) {
      gor.add(k);
      out.push({ lang: cell.lang, format: cell.format });
    }
  }
  return out;
}

function grupHucreleri(runData, g) {
  return hucreler(runData).filter(({ cell }) => cell.lang === g.lang && cell.format === g.format);
}

function grupAdi(g) {
  return `${String(g.lang).toUpperCase()} · ${FORMAT_ADI[g.format] ?? g.format}`;
}

function siralanmis(runData, g) {
  const liste = grupHucreleri(runData, g).filter(({ cell }) => cell.score && !cell.score.siralamaDisi);
  return liste
    .map((x, i) => ({ ...x, i }))
    .sort((a, b) => b.cell.score.puan - a.cell.score.puan || a.i - b.i);
}

function baslikBolumu(runData) {
  const q = runData.quota;
  const tum = hucreler(runData);
  const hatali = tum.filter(({ cell }) => cell.error != null).length;
  const L = [];
  L.push(`# Niş Avcısı raporu: ${runData.runId}`);
  L.push('');
  if (runData.derivedMetrics) {
    // Türetilmiş metrik eki "açık ve belirgin" etiket ister; inceleyici Türkçe bilmeyebilir.
    L.push(
      '> **Türetilmiş metrikler** (oran, medyan, günlük izlenme, puan, gelir tahmini) bu aracın hesabıdır, YouTube verisi değildir. Gelir tahmini üçüncü taraf RPM tahminidir.',
    );
    L.push('>');
    L.push(
      '> **Derived metrics** (ratio, median, views per day, score, revenue estimate) are calculated independently by this tool and are not YouTube data. Revenue figures are third-party RPM estimates, not YouTube data.',
    );
    L.push('');
  }
  L.push('- Veri kaynağı / Data source: YouTube (YouTube Data API v3)');
  L.push(`- Tarih: ${fmtTarih(runData.createdAt)}`);
  L.push(`- Mod: ${runData.derivedMetrics ? 'türetilmiş' : 'ham'}`);
  L.push(`- Kota (Pasifik günü ${q?.day ?? DASH}): ${kota(q)}`);
  const neden = durmaNedeni(q);
  if (neden) L.push(`- Erken durdu: ${neden}`);
  L.push(`- Hatalı hücre sayısı: ${hatali} / ${tum.length}`);
  const p = runData.params;
  if (p) {
    L.push(
      `- Parametreler: dil ${(p.langs ?? []).join(', ')}; format ${(p.formats ?? []).map((f) => FORMAT_ADI[f] ?? f).join(', ')}; son ${p.days} gün`,
    );
  }
  return L.join('\n');
}

function karsilastirmaBolumu(runData) {
  const satirlar = [];
  for (const n of runData.niches ?? []) {
    const diller = [...new Set((n.cells ?? []).map((c) => c.lang))];
    for (const lang of diller) {
      const satir = [esc(n.etiket ?? n.id), String(lang).toUpperCase()];
      for (const format of ['uzun', 'kisa']) {
        const c = (n.cells ?? []).find((x) => x.lang === lang && x.format === format);
        if (!c || c.error != null || !c.metrics || c.metrics.n === 0) {
          satir.push(DASH, DASH, DASH);
        } else {
          const m = c.metrics;
          satir.push(
            fmtGunluk(m.medianViewsPerDay),
            `${m.firsatKanallari.length}/${m.kanalSayisi}`,
            c.aylikTahmin ? fmtBand(c.aylikTahmin) : DASH,
          );
        }
      }
      satirlar.push(satir);
    }
  }
  const L = ['## Karşılaştırma (mutlak sayılar)', ''];
  L.push(
    'Her sütun mutlak sayıdır; gruplar arası karşılaştırma için puan değil bunlar kullanılır. Fırsat = fırsat kanalı sayısı / farklı kanal sayısı.',
  );
  L.push('');
  if (satirlar.length === 0) {
    L.push('Veri yok.');
  } else {
    L.push(
      tablo(
        [
          'Niş',
          'Dil',
          'Uzun: medyan günlük izlenme',
          'Uzun: fırsat',
          'Uzun: aylık tahmin',
          'Kısa: medyan günlük izlenme',
          'Kısa: fırsat',
          'Kısa: aylık tahmin',
        ],
        satirlar,
      ),
    );
  }
  return L.join('\n');
}

function siralamaBolumu(runData) {
  const L = ['## Sıralama', ''];
  L.push('Puan yalnız aynı dil ve formattaki nişleri birbiriyle sıralar. Parçalar: f = fırsat, t = talep, a = açıklık, p = para.');
  for (const g of gruplar(runData)) {
    L.push('', `### ${grupAdi(g)}`, '');
    const sirali = siralanmis(runData, g);
    const disi = grupHucreleri(runData, g).filter(({ cell }) => cell.score && cell.score.siralamaDisi);
    if (sirali.length === 0) {
      L.push('Sıralanacak niş yok.');
    } else {
      L.push(
        tablo(
          ['#', 'Niş', 'Puan', 'f/t/a/p', 'Fırsat', 'Medyan günlük izlenme', 'Büyük kanal payı', 'RPM bandı', 'n', 'Uyarılar'],
          sirali.map(({ niche, cell }, i) => {
            const sc = cell.score;
            const m = cell.metrics;
            const p = sc.parcalar;
            return [
              String(i + 1),
              esc(niche.etiket ?? niche.id),
              String(sc.puan),
              `${p.firsat}/${p.talep}/${p.acik}/${p.para}`,
              `${m.firsatKanallari.length}/${m.kanalSayisi}`,
              fmtGunluk(m.medianViewsPerDay),
              fmtPct(m.buyukKanalPayi),
              fmtBand(cell.rpmBand),
              String(m.n),
              esc(sc.uyarilar.length ? sc.uyarilar.join('; ') : DASH),
            ];
          }),
        ),
      );
    }
    if (disi.length) {
      L.push('', 'Sıralama dışı (yetersiz örnek):');
      for (const { niche, cell } of disi) {
        L.push(`- ${esc(niche.etiket ?? niche.id)} (n=${cell.metrics ? cell.metrics.n : DASH})`);
      }
    }
  }
  return L.join('\n');
}

function firsatBolumu(runData) {
  const L = ['## Fırsat kanalları', ''];
  L.push('Her grubun ilk 3 niş için; küçük ya da yeni kanalların izlenme/abone oranı eşiği aşan videoları.');
  for (const g of gruplar(runData)) {
    L.push('', `### ${grupAdi(g)}`);
    const ilk = siralanmis(runData, g).slice(0, 3);
    if (ilk.length === 0) {
      L.push('', 'Sıralanacak niş yok.');
      continue;
    }
    for (const { niche, cell } of ilk) {
      L.push('', `#### ${esc(niche.etiket ?? niche.id)}`, '');
      const f = cell.metrics?.firsatKanallari ?? [];
      if (f.length === 0) {
        L.push('Fırsat kanalı yok.');
        continue;
      }
      L.push(
        tablo(
          ['Kanal', 'Abone', 'Kanal yaşı (gün)', 'Video', 'İzlenme', 'Oran', 'Link'],
          f.map((k) => [
            esc(k.channelTitle),
            k.subscriberCount == null ? 'gizli' : fmtInt(k.subscriberCount),
            fmtInt(k.channelAgeDays),
            esc(k.title),
            fmtInt(k.viewCount),
            fmtOran(k.oran),
            link(k.videoId),
          ]),
        ),
      );
    }
  }
  return L.join('\n');
}

function hamBolumu(runData) {
  const L = ['## Ham veri', ''];
  L.push('YouTube API alanları olduğu gibi; hücre başına izlenmeye göre ilk 15 video. Sıralama ve hesap yok.');
  for (const { niche, cell } of hucreler(runData)) {
    L.push('', `### ${esc(niche.etiket ?? niche.id)} · ${grupAdi(cell)}`, '');
    const rows = [...(cell.rows ?? [])]
      .sort((a, b) => (b.video.viewCount ?? -1) - (a.video.viewCount ?? -1))
      .slice(0, 15);
    if (rows.length === 0) {
      L.push(`Veri yok${cell.error ? ` (${esc(cell.error)})` : ''}.`);
      continue;
    }
    L.push(
      tablo(
        ['Video', 'Kanal', 'İzlenme', 'Yayın tarihi', 'Abone', 'Kanal açılışı', 'Link'],
        rows.map((r) => [
          esc(r.video.title),
          esc(r.video.channelTitle),
          fmtInt(r.video.viewCount),
          fmtTarih(r.video.publishedAt),
          !r.channel || r.channel.subscriberCount == null ? 'gizli' : fmtInt(r.channel.subscriberCount),
          fmtTarih(r.channel?.publishedAt),
          link(r.video.id),
        ]),
      ),
    );
  }
  return L.join('\n');
}

function yontemBolumu(runData, s) {
  const L = ['## Yöntem ve etiketler', ''];
  L.push('Oran, medyan, günlük izlenme, puan ve gelir tahmini bu aracın hesabıdır, YouTube verisi değildir.');
  L.push('(Ratio, median, views per day, score and revenue estimate are calculated by this tool, not YouTube data.)');
  L.push('');
  L.push('Gelir tahmini üçüncü taraf RPM tahminidir (config/rpm.json), YouTube verisi değildir.');
  L.push('(Revenue figures are third-party RPM estimates, not YouTube data.)');
  L.push('');
  L.push(`Kısa = ≤ ${s.kisaMaxSaniye} sn video; dikey Shorts olduğu doğrulanamaz.`);
  L.push('');
  L.push('Puan yalnız aynı dil ve formattaki nişleri sıralar.');
  L.push('');
  if (!runData.derivedMetrics) {
    L.push('### Neden puan yok');
    L.push('');
    L.push(
      'Bu koşu ham modda yapıldı: türetilmiş metrikler (oran, medyan, günlük izlenme, puan, gelir tahmini) hesaplanmadı, nişler sıralanmadı. YouTube API Hizmet Şartları API verisinden türetilmiş ölçü üretmek için ek kabul ister; config/ayarlar.json içinde `turetilmisMetrikEkiKabulEdildi` bu yüzden `false`.',
    );
    L.push('');
    L.push(
      'Ek kabul başvurusu: https://support.google.com/youtube/contact/yt_api_form → Section 5 → Analytics & Reporting. Kabul alınınca ayar `true` yapılır.',
    );
    L.push('');
  }
  L.push('### Formüller ve eşikler');
  L.push('');
  L.push(`- Uzun = süre ≥ ${s.uzunMinSaniye} sn; kısa = 1..${s.kisaMaxSaniye} sn; arası ve süresiz videolar dışarıda.`);
  L.push(`- Her kanaldan en çok ${s.kanalBasinaMaxVideo} video (izlenmeye göre en yüksekler).`);
  L.push('- Günlük izlenme = izlenme / video yaşı (gün, en az 1).');
  L.push('- Oran = izlenme / max(abone, abone tabanı).');
  L.push('- Fırsat kanalı: küçük ya da yeni kanal, oran ≥ eşik, izlenme ≥ en az izlenme; kanal başına en yüksek oranlı video.');
  for (const lang of Object.keys(s.esik)) {
    const e = s.esik[lang];
    L.push(
      `- ${lang.toUpperCase()}: küçük kanal ≤ ${fmtInt(e.kucukKanalAbone)} abone, yeni kanal ≤ ${fmtInt(e.yeniKanalGun)} gün, büyük kanal ≥ ${fmtInt(e.buyukKanalAbone)} abone, oran eşiği ${fmtInt(e.oran)}, abone tabanı ${fmtInt(e.aboneTabani)}, en az izlenme ${fmtInt(e.minIzlenme)} (kısa ×${s.kisaCarpani.minIzlenme}), referans günlük izlenme ${fmtInt(e.referansGunlukIzlenme)} (kısa ×${s.kisaCarpani.referansGunlukIzlenme}).`,
    );
  }
  L.push(
    `- Puan = ${s.agirlik.firsat} × fırsat + ${s.agirlik.talep} × talep + ${s.agirlik.acik} × açıklık + ${s.agirlik.para} × para (her parça 0..100). Fırsat = en az ${s.firsatMinKanal} fırsat kanalı varsa min(100, 25 × kanal sayısı). Talep = log ölçekli medyan günlük izlenme / referans. Açıklık = 100 × (1 − büyük kanal payı). Para = log ölçekli RPM bandı ortası / en yüksek band ortası.`,
  );
  L.push(`- ${s.minOrnek} videodan az örnek sıralama dışı kalır.`);
  return L.join('\n');
}

export function buildReport(runData, s) {
  const json = structuredClone(runData);
  const derived = runData.derivedMetrics === true;
  const parcalar = [baslikBolumu(runData)];
  if (derived) {
    parcalar.push(karsilastirmaBolumu(runData), siralamaBolumu(runData), firsatBolumu(runData));
  } else {
    parcalar.push(hamBolumu(runData));
  }
  parcalar.push(yontemBolumu(runData, s));
  return { markdown: parcalar.join('\n\n') + '\n', json };
}
