# YouTube API formu: türetilmiş metrik eki başvurusu (taslak, 2026-11-18)

Form: https://support.google.com/youtube/contact/yt_api_form
Bu bir **uyum denetimi (compliance audit)** formu. YouTube inceler, kabul otomatik değil, süre belirtilmiyor. Formu sen doldurur, sen gönderirsin. Kutulardaki İngilizce metinleri olduğu gibi yapıştırabilirsin. `[...]` olan yerleri sen doldur.

## Göndermeden önce gerekenler (ön koşullar)
Form bunlar olmadan gönderilemez:
1. **https ile açılan bir "Primary Access URL" ve "Primary Website".** Aracın web arayüzü yok. En sade yol: kodu herkese açık bir GitHub deposuna koymak (`.env` ve `out/` zaten git dışı, depoya girmez). Depo adresi iki alan için de kullanılır.
2. **Gizlilik politikası adresi (zorunlu) ve kullanım şartları (dosya zorunlu).** Taslakları en altta. GitHub'da `PRIVACY.md` ve `TERMS.md` olarak durabilirler.
3. **Ekran görüntüleri (JPEG/PNG):** gizlilik politikası sayfası, ana sayfada gizlilik linkinin göründüğü bir görüntü (depo README'sinde link) ve kullanım şartları.
4. **Google Cloud proje numarası:** Console → proje seçili → "Gösterge tablosu" → "Proje bilgileri" → **Proje numarası** (yalnız rakamlar; proje kimliği değil).
5. İsteğe bağlı ama faydalı: türetilmiş metriklerin etiketlendiğini gösteren rapor görüntüsü (sahte veriyle `node test/ornek-rapor.mjs` çıktısı) ve kısa bir ekran kaydı.

Durum (2026-11-18): 1 ve 2 hazır. Depo `ertugrulunal9-ui/nis-avcisi` olacak; kökte `PRIVACY.md`, `TERMS.md` var ve README'nin başında İngilizce özet ile iki link duruyor (ana sayfa görüntüsündeki gizlilik linki). İletişim e-posta yerine deponun Issues sayfası. Ekran görüntüleri depo yayımlanınca alınır.

---

## Section 1: Request Type
- **Reason for request:** "Complete a compliance audit to request for additional quota"
  - Not: Formda "eki kabul et" diye ayrı bir seçenek yok. YouTube ek başvurularının standart kota uzatma talebinden geçtiğini söylüyor (Developer Policies III.L). 5. bölümde kota olarak "No change" seçiliyor, gerekçede de amacın ek kabulü olduğu yazıyor. Bu benim okumam, YouTube'un açık talimatı değil.

## Section 2: Organization and Contact Information
- **Are you applying:** individual user
- **Your Full Legal Name:** [ADIN SOYADIN]
- **Your Organization's Legal Name:** [ADIN SOYADIN] (Individual developer)
- **Parent Company Name:** boş
- **Your Organization's Primary Website:** `https://github.com/ertugrulunal9-ui/nis-avcisi`
- **Country:** Other → Türkiye
- **Street Address / City / State/Province / Postal Code:** [adresin]
- **Category:** Creator Tools and Services
- **Organization Size / Type:** Independent Developer/Sole Proprietor
- **Primary Contact Name and Email:** [adın], [e-postan]
- **Primary Technical Contact / Primary Business Contact:** "Same as Primary Contact"

## Section 3: Business Model and Google Contacts
**Describe your organization's work as it relates to YouTube** (100–5000 karakter):
```
I am an individual developer in Türkiye preparing to start my own YouTube channel with educational, faceless videos produced with the help of AI tools. To decide which topics to make videos about, and whether to make them in Turkish or English and as long-form videos or short videos, I built a small private command-line tool called "Nis Avcisi" ("niche finder").

The tool runs only on my own computer and I am its only user. It uses an API key (no OAuth, no user accounts) and reads only public data through the YouTube Data API v3: search.list for about 20 topic queries in Turkish and English, then videos.list and channels.list for the returned videos and their channels (public view counts, durations, publish dates, subscriber counts and channel creation dates).

From this data the tool calculates a few derived metrics for each topic: views per day, the ratio of a video's views to its channel's subscriber count (to see whether small or new channels can succeed in that topic), the median views per day of the topic's videos, a composite topic score used only to rank topics against each other, and a monthly revenue range based on published third-party RPM estimates. The result is a local Markdown report that only I read. Every derived metric is labeled in the report as "calculated by this tool, not YouTube data", and revenue figures are labeled as "third-party RPM estimate, not YouTube data". Raw API fields are shown separately from derived metrics.

The tool has no database. All API data and reports are deleted automatically after 30 days. Nothing is published, shared, sold or shown to anyone else, and the tool is not monetized.
```

- **Who is your target audience?:** Internal Users
- **How does your API Client monetize or generate revenue?:** Other (please specify): `Not monetized. Single-user internal research tool.`
- **Do you sell advertisements or sponsorships ON or WITHIN YouTube video content:** Not applicable
- **Do you currently have a designated Google Partner Manager:** No Google representative
- **Representative Name / Email:** alan zorunlu görünürse `N/A`
- **How did you first learn about the YouTube Data API?:** Google Developer Documentation
- **Content Owner ID(s), Google Ads Customer ID(s):** boş

## Section 4: API Client Overview and Access Information
- **API Client Name:** Nis Avcisi
- **Does this API Client name contain the word "YouTube"?:** No
- **Primary Access URL:** `https://github.com/ertugrulunal9-ui/nis-avcisi`
- **Privacy Policy URL:** `https://github.com/ertugrulunal9-ui/nis-avcisi/blob/main/PRIVACY.md`
- **Terms of Service URL:** `https://github.com/ertugrulunal9-ui/nis-avcisi/blob/main/TERMS.md`
- **Is your API Client publicly accessible?:** No
- **Demo Account Username / Password, Login URL:** boş (giriş yok)
- **Special Instructions for Access:**
```
Nis Avcisi is a local command-line tool (Node.js) that runs only on the developer's own computer. There is no hosted interface and no login. The source code is available at the Primary Access URL. A sample report (generated with synthetic data) showing how derived metrics and estimates are labeled is attached as a screenshot.
```
- **Acknowledgment checkbox:** işaretle

## Section 5: Use Cases and Quota Extension Details
- **How many project numbers are you adding?:** 1
- **Google Cloud Project Number:** [proje numaran]
- **Use Case Category:** Analytics & Reporting (YouTube'un ek sayfası tam olarak bunu söylüyor)
- **Does this API Client require users to sign in with their Google Account (OAuth 2.0)?:** No
- **Derived metrics and data storage agreement:** işaretle ("I have read and agree to abide by the additional policies for derived metrics and data storage.")
- **Expected API Usage Volume:** Fewer than 1,000/day
- **Evidence:** ön koşul 3'teki görüntüler; "dashboard/feature screenshots" için örnek rapor görüntüsü
- **Quota endpoints:** youtube.search.list, youtube.videos.list, youtube.channels.list
- **Quota request:** No change / Default quota (10k quota points)
- **Total Per Day Quota:** 10000
- **Detailed Justification:**
```
I am not asking for more quota; the default quota is enough. I am submitting this form to accept the amendment for derived metrics and data storage (selecting "Analytics & Reporting" as instructed on the derived metrics policy page), because my tool calculates derived metrics from public API data.

Typical daily usage: up to 95 search.list calls and about 200 units for videos.list and channels.list. The tool counts quota locally and stops before the daily limit.

Derived metrics: views per day, views-to-subscriber ratio, median views per day per topic, a composite topic score (used only to rank topics against each other) and a monthly revenue range from third-party RPM estimates. In the report every derived metric is labeled "calculated by this tool, not YouTube data", revenue figures are labeled "third-party RPM estimate, not YouTube data", and raw API fields are shown separately. No custom categories replace YouTube's categories.

Storage: no database. API data and reports are deleted automatically after 30 days. The API key is stored locally and never shared. The tool is used only by me to decide what topics to create videos about for my own channel; nothing is published or shared.
```
- **youtube.search.list Total Per Day Quota:** 100
- **youtube.search.list Detailed Justification:**
```
Default allocation (100 calls/day) is enough. One scan uses about 80 calls: 20 topics x 2 languages (Turkish, English) x 2 search phrasings, at most once per day. The tool stops locally at 95 calls.
```

---

## Ek A ve B: Gizlilik politikası ve kullanım şartları
Hazır: depo kökünde [PRIVACY.md](../PRIVACY.md) ve [TERMS.md](../TERMS.md). İçerik YouTube Developer Policies III.A şartlarına göre yazıldı (YouTube ToS linki, Google Privacy Policy linki, YouTube API Services kullanıldığı bildirimi, cihazda saklama bildirimi).

## Bilinmeyenler
- YouTube'un ne kadar sürede yanıt verdiği ve tek kişilik, yerel bir aracı kabul edip etmediği belirsiz. Ek sayfası "If your use case is accepted" diyor, yani inceleme var.
- "Primary Access URL" için GitHub deposunun yeterli sayılıp sayılmayacağı bilinmiyor.
