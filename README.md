# Niş Avcısı

> **English summary.** Nis Avcisi ("niche finder") is a personal, single-user command-line tool that helps its developer decide which topics to make YouTube videos about, in Turkish or English, as long or short videos. It reads public data through the YouTube Data API v3 with an API key (no OAuth): `search.list`, `videos.list`, `channels.list`, about 80 searches per day at most. It writes a local Markdown report. Derived metrics are labeled as calculated by this tool, not YouTube data, and revenue figures are labeled as third-party estimates. API data is deleted automatically after 30 days. Nothing is published or shared.
>
> **[Privacy Policy](PRIVACY.md)** · **[Terms of Use](TERMS.md)** · Uses [YouTube API Services](https://developers.google.com/youtube); by using it you agree to the [YouTube Terms of Service](https://www.youtube.com/t/terms).

Yapay zekâ ile YouTube içeriği üretmeden önce "hangi niş, hangi dil, uzun mu kısa mı" sorusunu veriyle yanıtlayan ücretsiz, yerel araç. Ücretli niş araçlarının (NexLev, 1of10, vidIQ) çekirdek sinyalini, yani küçük ya da yeni kanalların birden fazlasının büyük izlenme almasını, YouTube'un ücretsiz API'siyle ölçer.

**Kullanım:** Bu klasörde bir Claude oturumu aç ve "niş tara" de. Claude `.claude/skills/nis-tara/SKILL.md`'yi izler, aracı çalıştırır ve sana özet yazar. Komut yazman gerekmez.

## Kurulum (bir kez, ~5 dk, ücretsiz)
1. https://console.cloud.google.com adresinde yeni bir proje aç.
2. "API'ler ve Hizmetler → Kitaplık" → **YouTube Data API v3** → **Etkinleştir**.
3. "Kimlik bilgileri → Kimlik bilgisi oluştur → API anahtarı". Anahtarı "YouTube Data API v3" ile sınırla.
4. Bu klasördeki `.env` dosyasını Not Defteri'yle aç, `YT_API_KEY=` satırının sonuna anahtarı yapıştır, kaydet. Anahtarı sohbete yapıştırma. `.env` git'e girmez.

## Puanlama izni (önerilir)
YouTube'un geliştirici politikası (III.E.4.h) API verisinden oran, medyan ya da puan gibi **türetilmiş metrik** üretmeyi varsayılan olarak yasaklar. "Derived Metrics" eki kabul edilince izin verir.
- Form: https://support.google.com/youtube/contact/yt_api_form → "Section 5: Use Cases, API Integration, and Feature Implementation" → kullanım: "Analytics & Reporting".
- Kabul edilene kadar araç **ham modda** çalışır: puan ve karşılaştırma yok, yalnız ham listeler.
- Kabulden sonra Claude'a söyle. `config/ayarlar.json`'da `turetilmisMetrikEkiKabulEdildi: true` yapılır.

## Ne ölçer
- Her niş için, dil başına 2 arama ifadesi, son 180 günün videoları. Türkçe için bölge TR, İngilizce için US.
- Uzun (≥ 4 dk) ve kısa (≤ 3 dk) ayrı ayrı ölçülür:
  - medyan günlük izlenme;
  - **fırsat kanalları**: abonesi az ya da 1 yaşından küçük kanal, videosu abone sayısının en az 3 katı izlenmiş (TR'de en az 10 bin, EN'de 30 bin izlenme; kısa videoda 5 katı);
  - büyük kanal payı;
  - aylık gelir tahmini (üçüncü taraf RPM tahmini, güveni düşük).
- Puan yalnız aynı dil ve formattaki nişleri sıralar. Türkçe/İngilizce ve uzun/kısa karşılaştırması mutlak sayılarla yapılır.
- TikTok ve Instagram ölçülmez: ücretsiz meşru veri yok ve Türkiye'den doğrudan gelir yolu yok (`docs/arastirma-2026-11-18.md`).

## Sınırlar
- Günde 100 arama: tam tarama (20 niş) günde bir kez. Kota Pasifik gece yarısı sıfırlanır (İstanbul'da kışın 11:00, yazın 10:00).
- YouTube API verisi 30 günden fazla tutulamaz: `out/` klasörleri 30 günde kendiliğinden silinir.
- Bir hücre en fazla ~100 video görür. Sonuç bir gösterge, kesin hüküm değil.
- RPM bantları tahmin. Kendi kanalında YouTube Studio'daki gerçek RPM'i görünce `config/rpm.json`'u güncelle.

## Dosyalar
- `config/nisler.json`: ölçülecek nişler. Claude kesif sonuçlarına göre ekler.
- `config/ayarlar.json`: eşikler, ağırlıklar, kota payları.
- `config/rpm.json`: RPM bantları.
- `docs/tasarim.md`: tasarım ve modüller arası sözleşme.
- `docs/arastirma-2026-11-18.md`: araştırma ve kaynaklar.
- Testler: `npm test` (ağa çıkmaz, sahte veriyle).
