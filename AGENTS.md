# Niş Avcısı: çalışma notları

Bu depoda çalışan tüm yapay zekâ ajanları için. Kullanıcı Türkçe ve sade dil ister; değişikliğin kullanıcıya etkisini teknik ayrıntıdan önce söyle.

## Ne bu
Yapay zekâ ile YouTube içeriği üretecek kullanıcı için ücretsiz niş bulucu. YouTube Data API v3 ile nişleri Türkçe/İngilizce ve uzun/kısa video olarak ölçer, `out/<koşu>/rapor.md` yazar. Kullanıcı komut yazmaz: Claude `.claude/skills/nis-tara/SKILL.md` ile çalıştırıp özetler. Ayrıntı: `README.md`, `docs/tasarim.md` (modüller arası sözleşme), `docs/arastirma-2026-11-18.md` (kaynaklar).

## Çalıştırma / test
- `node src/cli.mjs durum` / `tara [--nisler a,b] [--dil tr,en] [--format uzun,kisa] [--gun 180]` / `kesfet "<tohum>" [--dil tr,en]`.
- Test: `npm test` (node:test, ağsız, `test/helpers/fake-fetch.mjs`). Örnek rapor: `node test/ornek-rapor.mjs <klasör>` (sahte veri, gerçek kotaya dokunmaz).
- Node 24, bağımlılık yok. Çıkış kodu: 0 başarı (erken durma dahil), 1 hata, 2 anahtar yok/geçersiz.

## Kurallar
- `.env`'i okuma, yazdırma, sohbete yapıştırma. Anahtar yalnız `X-Goog-Api-Key` başlığıyla googleapis.com'a gider; URL/log/hata/raporda görünmez.
- YouTube politikası (doğrulandı 2026-11-18): API verisi 30 günde silinir (`out/` her komutta temizlenir); türetilmiş metrik (oran, medyan, puan, gelir tahmini) yalnız `turetilmisMetrikEkiKabulEdildi: true` iken. Ham modda Claude da oran hesaplamaz, niş sıralamaz.
- Kota: günde 100 arama (ayrı kova), 10.000 birim; pay 95/9000. Gerçek taramayı gereksiz tekrarlama; test için sahte veri kullan.
- RPM bantları tahmin; raporda ve özette hep "üçüncü taraf tahmini".
- Fikir/niş önerisi veriden gelir (kesif + tarama); klişe liste verme.
- Kullanıcı açıkça istemeden git commit/push yok.

## Kararlar
- 2026-11-18: Proje açıldı. Kullanıcı: platform YouTube uzun video ağırlıklı ama karşılaştırmayı sistem yapsın; dil Türkçe ve İngilizce karşılaştırmalı; kullanım "Claude çalıştırsın, ben okuyayım". Yığın Node 24 bağımlılıksız.
- 2026-11-18: Tasarım v2 (iki egm incelemesinden sonra): fırsat = küçük/yeni kanal + izlenme/abone ≥ 3 + en az 2 kanal; puan yalnız grup içi sıralama, karşılaştırma mutlak sayılarla; arama süre filtresiz; veritabanı yok. Gerekçe `docs/tasarim.md` sonu.
- 2026-11-18: TikTok/Instagram ölçülmez (ücretsiz meşru veri yok, Türkiye'den doğrudan gelir kanıtı yok). Türkiye'den doğrulanmış tek doğrudan reklam geliri YouTube YPP.

## Güncel durum
- Tarih: 2026-11-18
- v1 kodu yazıldı (iki Sonnet alt ajanı; ana oturum inceledi): `src/` 11 modül, `test/` 9 test dosyası + sahte fetch. Git deposu yok, commit yok.
- Doğrulandı: `npm test` 81/81; `durum` (anahtar yok, ham mod, kota 0/95); anahtarsız `tara` çıkış 2 + kurulum mesajı; bilinmeyen niş çıkış 1; `node test/ornek-rapor.mjs` sahte veriyle türetilmiş rapor (Türkçe, tablolar, etiketler doğru; gerçek kota/out'a dokunmadı); `kesfet` gerçek öneri ucunda çalıştı (tr 25, en 27 öneri, Türkçe karakterler doğru). Ana oturum düzeltmesi: `publishedAfter` milisaniyesiz, kimlikli isteklerde `maxResults` yok (test beklentisi buna göre güncellendi).
- 2026-11-18 22:48 TR **ilk gerçek tarama** (koşu `2026-11-18-2248`, ham mod, `--nisler osmanli,uzay`): 8 arama + 14 birim (beklenen), 8/8 hücre dolu, hata 0; dil filtresi çalıştı (TR hücrelerinde yalnız tr, EN'de yalnız en, 1 dil etiketi boş video tutuldu), kanalsız video 0, süre 4 sn–8 sa doğru çözüldü. Hücre başına 19–63 video. Bulunan tek sorun arama ifadesi: EN "universe explained" Marvel/oyun evrenlerini getirdi → "space explained" yapıldı. Türetilmiş mod gerçek veride henüz denenmedi.
- Kullanıcıda: türetilmiş metrik eki formu (README "Puanlama izni"). Ek kabul edilene kadar araç ham modda; Claude ham veriden niş sıralamaz.
- 2026-11-18: Form okundu, basit onay değil **uyum denetimi**: zorunlu alanlar arasında https erişim adresi, gizlilik politikası adresi, gizlilik/ana sayfa/şartlar ekran görüntüleri, yasal ad ve açık adres var; YouTube inceler (süre ve sonuç belirsiz). Alan alan İngilizce metin + PRIVACY/TERMS taslakları: `docs/youtube-form-metni.md` (zorunlu bağlantılar III.A'dan doğrulandı). Önerilen ön koşul: kodu herkese açık GitHub deposuna koymak (adres + PRIVACY.md + TERMS.md); kullanıcının kararı, yapılmadı.
- İlk kesif gözlemi (2026-11-18): Türkçe "osmanlı tarihi" önerilerinin çoğu KPSS sınav hazırlığı; iki dilde de "uyku belgeseli / for sleep" önerisi var. Ölçülmedi, yalnız ipucu.
- Sıradaki adım: ek formu gönderilince `turetilmisMetrikEkiKabulEdildi: true` → tam tarama (80 arama, günde bir) → Claude özeti.
