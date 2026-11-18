---
name: nis-tara
description: Niş Avcısı'nı çalıştırıp YouTube nişlerini Türkçe/İngilizce ve uzun/kısa video olarak ölçer, raporu okuyup kullanıcıya Türkçe özet yazar. Kullanıcı "niş tara", "hangi nişe gireyim", "niş bul", "şu konuyu tara/derinleştir", "içerik fikri bul" dediğinde kullan.
---

# Niş tarama (Claude çalıştırır, kullanıcı okur)

Kullanıcı komut yazmaz. Komutları sen çalıştırırsın, sonucu sade Türkçeyle anlatırsın. Proje kökü bu deponun kökü. Ayrıntılı tasarım: `docs/tasarim.md`.

## 1. Ön kontrol
- `node src/cli.mjs durum` çalıştır. `.env` dosyasını **okuma, yazdırma**; anahtarın varlığını yalnız bu komut söyler.
- Anahtar yoksa ya da tarama çıkış 2 verdiyse dur, README "Kurulum" adımlarını kısaca ver.
- `durum` bugünkü kalan aramayı (Pasifik günü) gösterir. Tam tarama 20 niş × 2 dil × 2 ifade = 80 arama ister; pay 95. Yetmiyorsa `--nisler` ile böl ya da kota sıfırlanınca devam et (Pasifik gece yarısı = İstanbul saatiyle kışın 11:00, yazın 10:00).
- **Mod `ham` ise** (türetilmiş metrik eki kabul edilmemiş): raporda puan, oran, karşılaştırma yok. Bu modda sen de oran/medyan hesaplama, nişleri sıralama; bu da türetilmiş metrik sayılır (YouTube politikası III.E.4.h). Yalnız ham alanları anlat (başlık, izlenme, yayın tarihi, abone, kanal açılış tarihi) ve kullanıcıya bir cümleyle eki hatırlat (README "Puanlama izni"). Ek kabul edilince kullanıcı söyler, sen `config/ayarlar.json`'da `turetilmisMetrikEkiKabulEdildi`'yi `true` yaparsın.

## 2. Ne taranacak
- Kullanıcı konu vermediyse: `node src/cli.mjs tara` (config/nisler.json'daki tüm nişler).
- Kullanıcı bir konu verdiyse ya da önceki raporda bir niş öne çıktıysa (derinleştirme):
  1. Her dile kendi dilinde tohum ver: `node src/cli.mjs kesfet "<Türkçe konu>" --dil tr` ve `node src/cli.mjs kesfet "<English topic>" --dil en` (API kotası harcamaz) → `out/<koşu>-kesif/kesif.md`'leri oku. Öneriler talep ölçüsü değil, yalnız ipucu (ör. 2026-11-18'de "osmanlı tarihi" önerilerinin çoğu KPSS'ydi).
  2. Önerilerden 5–10 **somut** alt niş seç (izleyicinin gerçekten aradığı ifadeler; kafadan ekleme). Her biri için dil başına 1–2 arama ifadesi yaz, `config/nisler.json`'a ekle (`id`, `etiket`, `kategori` rpm.json anahtarlarından biri, `tr: [...]`, `en: [...]`). Ne eklediğini kullanıcıya söyle.
  3. `node src/cli.mjs tara --nisler <id1,id2,...>`.
- Tek dil için `--dil tr`, tek format için `--format uzun`.

## 3. Raporu oku
- `out/<koşu>/rapor.md`, gerekirse `rapor.json` (sözleşme: docs/tasarim.md "runData").
- Türetilmiş modda `out/<koşu>/kapaklar/*.jpg`'e Read ile bak: yüzsüz mü, yapay zekâ ile üretilebilir mi, şablon/seri üretim görünümü var mı (YouTube "inauthentic content" riski), yeni gelen birinin yapabileceği bir format mı.

## 4. Kullanıcıya özet (Türkçe, sade; önce kullanıcıya etkisi)
Türetilmiş modda şu sırayla, kısa:
1. **En iyi 3–5 seçenek** (niş + dil + format): her biri için kanıt olarak 2–3 fırsat kanalı (abone, kanal yaşı, izlenme, link).
2. **Türkçe mi İngilizce mi**: raporun "Karşılaştırma" tablosundaki mutlak sayılarla (medyan günlük izlenme, fırsat k/n, aylık tahmin). Puanı gruplar arası karşılaştırmada kullanma.
3. **Uzun mu kısa mı**: aynı tabloyla. Kısa = ≤180 sn video; dikey Shorts olduğu doğrulanamaz.
4. **Platform notu**: TikTok/Reels için ücretsiz veri ve Türkiye'den doğrudan gelir yolu yok (`config/platformlar.json`).
5. **Yapay zekâ riski**: her önerilen niş için düşük/orta/yüksek + neden (senin yorumun, öyle etiketle).
6. **Zayıf noktalar**: küçük örnek (n), tek ya da iki kanal, RPM tahmini (güven düşük), arama sonucunun her gün biraz değişmesi.
7. **Sonraki adım**: tek öneri (ör. "X'i kesfet ile derinleştir" ya da "3 videoluk pilot, YouTube Studio'da gerçek RPM'i gör").
Özeti `out/<koşu>/ozet.md`'ye de yaz.

## Kurallar
- Gelir tahminini kesin bilgi gibi sunma; hep "üçüncü taraf RPM tahmini".
- Veride olmayan niş önerme; klişe "en iyi 10 yüzsüz niş" listesi verme. Kendi hipotezini "doğrulanmadı" diye etiketle.
- Yüksek riskli formatları (şablon seri, başkasının görüntüsüne yapay zekâ sesi, sahte fragman, yapay zekâ sunucuyla finans/sağlık) uyarısız önerme.
- Kullanıcı bir niş seçerse AGENTS.md `## Kararlar`'a tarih, niş, dil, format ve koşu kimliğiyle yaz.
- `out/` 30 günde silinir (YouTube politikası); uzun süreli not AGENTS.md'ye, API verisi (başlık, izlenme) olmadan.
