# Araştırma özeti (2026-11-18)

Üç alt ajan (Sonnet) araştırdı; kota ve politika maddelerini ana oturum Google'ın resmî sayfalarından ayrıca doğruladı. Reddit arama araçlarına kapalıydı; birinci el kullanıcı yorumu yok. Ajans/rakip blogları "[pazarlama]" sayıldı.

## 1. Ücretli araçlar ne yapıyor

| Araç | Çekirdek | Fiyat (2026, kısmen doğrulandı) |
|---|---|---|
| 1of10 | Outlier araması, niş gezgini, trend formatlar | Ücretsiz (ilk 5 sonuç), 19 $/ay |
| vidIQ | Outlier skoru, anahtar kelime puanı | Ücretsiz, 19 $/ay, 49 $/ay (resmî sayfa) |
| TubeLab | Niş/outlier bulucu, "yüzsüz" filtre, RPM tahmini | Kredi bazlı, resmî fiyat görünmedi |
| NexLev | Niş bulucu, RPM tahmini, "150M+ kanal" veritabanı | Resmî fiyat görünmedi |
| ViewStats | Eklentide izlenme grafiği, outlier | ~50 $/ay [pazarlama] |
| Exploding Topics | Trend veritabanı, analist onayı | 39 / 99 / 249 $/ay (resmî) |

- Ortak ana sinyal: **küçük ya da yeni kanalın büyük izlenme alması** ve bunun **birden fazla kanalda tekrar etmesi** (tek şans değil, format işliyor).
- Outlier tanımı araçlar arasında farklı: vidIQ "kanalın benzer dönemdeki ortalaması", 1of10 blogda ortalama, eklentide medyan diyor. Eşikler: 3x anlamlı, 5x+ viral. Biz **medyan** kullanıyoruz (tek hit ortalamayı şişirir).
- RPM tahminleri araçlarda da tahmin; formül açıklanmıyor.
- Kopyalanamayan: milyonlarca kanallık hazır veritabanı, geçmiş izlenme grafiği. Yerine: tohum nişlerle daraltılmış örneklem.

Kaynaklar: https://support.vidiq.com/en/articles/9660010 , https://www.vidiq.com/pricing/ , https://1of10.com/blog/viral-youtube-video-ideas-outlier-method/ , https://tubelab.net/pricing , https://nexlev.io/pricing , https://explodingtopics.com/pricing

## 2. Ücretsiz veri kaynakları

| Kaynak | Durum | Not |
|---|---|---|
| **YouTube Data API v3** | Omurga | Anahtar gerekir (kullanıcı açar). Kota aşağıda |
| YouTube arama önerisi (`suggestqueries.google.com`, `ds=yt`) | 200, anahtarsız | Belgesiz uç; uzun kuyruk keşfi için, yavaş ve önbellekli |
| YouTube kanal RSS | 200, anahtarsız | Yalnız son 15 video, izlenme yok; v1'de kullanılmıyor |
| Google Trends "Trending now" RSS | 200 | Günlük gündem (haber); niş için zayıf, v1'de yok |
| pytrends | Arşivlendi (2024-08) | Kullanılmaz |
| Resmî Google Trends API | Alfa, başvuruyla | Kullanılmaz |
| Wikipedia Pageviews | 200 | Meşru ama niş talebi için zayıf sinyal; v1'de yok |
| TikTok Creative Center | Boş JS kabuğu, giriş ister | Programatik ücretsiz erişim yok |
| TikTok Research API | Yalnız akademik | Ticari kullanım yasak |
| Instagram/Reels | Meşru ücretsiz trend verisi yok | — |
| Reddit | Anonim `.json` 403, API onay ister | Kullanılmaz |
| yt-dlp ile arama | YouTube ToS'a aykırı | Kullanılmaz |

### YouTube kotası (resmî sayfa, ana oturum doğruladı)
- "100 `search.list` calls, 100 `videos.insert` calls, and 10,000 units per day combined for all other endpoints." `search.list` kendi kovasında, çağrı başı 1.
- `videos.list`, `channels.list`, `playlistItems.list`: 1 birim/çağrı, 50 kimliğe kadar.
- Sıfırlama: Pasifik gece yarısı (İstanbul 10:00 / 11:00).
- Sonuç: darboğaz **günde 100 arama**. Niş × dil × format başına 1 arama → 20 niş × 2 dil × 2 format = 80 arama/gün.
- Kaynak: https://developers.google.com/youtube/v3/determine_quota_cost

### YouTube veri politikası (resmî sayfa, ana oturum doğruladı)
- III.E.4.b: anahtarla çekilen (yetkisiz) istatistikler 30 günden fazla saklanamaz. III.E.4.c/d: diğer veri 30 takvim gününde silinir ya da yenilenir.
- III.E.4.h: API verisinden "new or derived data or metrics" üretmek yasak (gösterilsin gösterilmesin).
- **İstisna**: "Derived Metrics" eki (https://developers.google.com/youtube/terms/derived-metrics-policy). İzinli örnekler: özel kanal skorları ve oranlar, büyüme sıralamaları. Şartlar: türetilmiş metrik API verisinden ayrı gösterilir; para tahminleri "üçüncü taraf tahmini, YouTube verisi değil" diye sunulur. Ek kabul edilince istatistik ve türetilmiş metrikler 36 ay saklanabilir; başlık, kanal adı ve açıklama yine 30 gün.
- Kabul yolu: https://support.google.com/youtube/contact/yt_api_form → "Section 5: Use Cases, API Integration, and Feature Implementation" → kullanım "Analytics & Reporting". Formu kullanıcı doldurur.
- İhlal yaptırımı: "API quota reduction or termination of your API access."
- Kaynak: https://developers.google.com/youtube/terms/developer-policies

## 3. Türkiye'den para yolu ve yapay zekâ politikası

| Platform | Türkiye'den doğrudan gelir | Güven |
|---|---|---|
| YouTube YPP | **Açık**. Tam: 1.000 abone + 12 ayda 4.000 saat (ya da 90 günde 10M Shorts). Genişletilmiş: 500 abone | Yüksek (resmî) |
| YouTube Shorts | YPP içinde havuz modeli | Orta |
| TikTok Creator Rewards | Türkiye için güvenilir kanıt yok | Orta |
| TikTok Shop | Türkiye'de yok görünüyor | Orta-düşük |
| Instagram Reels bonusu | Kapalı | Orta |
| Facebook içerik geliri | Doğrulanmadı | Düşük |

- "Türkiye'den para yolu yok" sonucu Instagram için doğru, YouTube için geçerli değil.
- RPM: niş bazında birinci el veri yok. İngilizce/ABD izleyici için ajans derlemesi (Virlo, 2026 [pazarlama]): yatırım CPM 20–40 $, kişisel finans 15–25 $, teknoloji 10–18 $, oyun 3–8 $. Üretici RPM'i ≈ CPM × 0,55. Türkiye CPM'i 1,2–4 $ (Mediacube). **Türkçe izleyici RPM'i ABD'nin ~%5–15'i (çıkarım, ölçülmedi).**
- Yapay zekâ içerik riski (YouTube "inauthentic content"; Temmuz 2025 değişikliği, ikincil kaynaklar):
  - Yüksek risk: şablon/seri üretim, başkasının görüntüsüne yapay zekâ sesi, duygusal manipülasyon, yapay zekâ sunucuyla finans/sağlık/hukuk, sahte fragman. Sonuncusu için kanıtlı kapatmalar var.
  - Düşük-orta risk: insanın yazıp kurguladığı, yapay zekânın araç olduğu özgün anlatım.
  - 2026 başında en büyük 100 "AI slop" kanalının 16'sı kaldırıldı (ikincil).
- Bu yüzden araç yapay zekâ riskini puana katmaz; Claude her önerilen niş için başlık ve kapaklardan şablon riskini ayrıca yorumlar.

Kaynaklar: https://support.google.com/youtube/answer/13429240 , https://outlierkit.com/resources/youtube-rpm-benchmarks/ [pazarlama] , https://mediacube.io/en/blog/youtube-cpm , https://techcrunch.com/2025/07/14/following-youtube-meta-announces-crackdown-on-unoriginal-facebook-content

## Doğrulanmadı
Reddit kullanıcı yorumları; NexLev/TubeLab/ViewStats gerçek fiyatları; niş bazında Türkçe RPM; TikTok Creative Center'da Türkiye seçimi; YouTube'un Temmuz 2025 politika metninin birincil kaynağı; Trendyol/Hepsiburada ortaklık komisyonları.
