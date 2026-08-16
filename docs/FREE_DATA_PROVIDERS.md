# Ücretsiz Dış Veri Sağlayıcıları

Bu kurulumda endpoint’ler hazırdır. `.env.homeserver` içinde yalnızca ilgili API key değerini doldurun ve `./scripts/homeserver-up.sh` komutunu yeniden çalıştırın. Key boşsa entegrasyon pasif kalır; worker başlamayı sürdürür ve veri uydurmaz.

## 1. Google Chrome UX Report (CrUX)

- Amaç: Origin düzeyinde mobil LCP, INP ve CLS için 28 günlük gerçek Chrome kullanıcı alan verisi.
- Ücret: Google dokümantasyonuna göre ücretsiz; proje başına 150 sorgu/dakika.
- API dokümantasyonu ve key alma: <https://developer.chrome.com/docs/crux/api>
- Google Cloud API sayfası: <https://console.cloud.google.com/apis/library/chromeuxreport.googleapis.com>
- Hazır endpoint: `https://chromeuxreport.googleapis.com/v1/records:queryRecord`

Google Cloud projesinde **Chrome UX Report API** servisini etkinleştirin, bir API key oluşturun ve yalnızca şunu doldurun:

```dotenv
CRUX_API_KEY=BURAYA_GOOGLE_CLOUD_KEY
```

CrUX’ta yeterli anonim Chrome örneği bulunmayan küçük siteler için sonuç gelmemesi normaldir ve hata/başarısızlık olarak yorumlanmaz.

## 2. Serper Google SERP API

- Amaç: Anahtar kelimenin gerçek Google organik sonuçlarında hedef domain konumu, sonuç URL’si ve SERP özellikleri.
- Başlangıç kotası: Sağlayıcının güncel sayfasına göre kredi kartı gerektirmeyen 2.500 ücretsiz sorgu.
- Kayıt ve API key: <https://serper.dev/>
- Hazır endpoint: `https://google.serper.dev/search`

Key’i ekleyin:

```dotenv
SERP_API_KEY=BURAYA_SERPER_KEY
```

`SERP_PROVIDER=serper` ve base URL hazırdır. Ücretsiz krediyi korumak için varsayılan bütçe günlük 50 sorgudur:

```dotenv
SERP_DAILY_QUERY_LIMIT=50
```

2.500 sorgu başlangıç kredisidir, yenilenen aylık ücretsiz kota olduğu varsayılmaz. Limit dolduğunda sistem eski observation’ları korur ve yeni sonuç üretmez.

## 3. OpenPageRank

- Amaç: Common Crawl tabanlı tahmini domain otoritesi, global rank ve authority-weighted referring-domain sayısı.
- Ücretsiz kota: Sağlayıcının güncel API dokümanına göre ayda 30.000 domain ve dakikada 60 istek.
- Key/dashboard ve dokümantasyon: <https://openpagerank.keywordseverywhere.com/docs>
- Hazır endpoint: `https://openpagerank.keywordseverywhere.com/v1/domains/bulk`

Dashboard’dan `opr_live_...` key oluşturup ekleyin:

```dotenv
OPENPAGERANK_API_KEY=BURAYA_OPR_KEY
```

OpenPageRank tam backlink listesi değildir. Verisi “Google otoritesi” veya sıralama faktörü olarak sunulmaz; yalnızca aynı sağlayıcı ve tarih içinde karşılaştırma/trend sinyalidir.

## Backlink listeleri hakkında

Ahrefs, Semrush, Majestic ve benzeri ayrıntılı backlink indekslerinin genel amaçlı, sürdürülebilir ücretsiz API katmanı yoktur. Bu nedenle `BACKLINK_PROVIDER` varsayılan olarak `disabled` bırakılmıştır. Ücretsiz olmayan bir sağlayıcı sözleşmesi olmadan backlink satırı, anchor text veya link kalitesi uydurulmaz.

## Etkinleştirme

Key’leri girdikten sonra:

```bash
./scripts/homeserver-up.sh
```

Sonra yeni bir audit çalıştırın. CrUX ve OpenPageRank audit sırasında; Serper ise aktif keyword’ler için scheduler üzerinden en fazla günlük bütçe kadar observation üretir.

