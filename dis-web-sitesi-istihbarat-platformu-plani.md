# Dış Web Sitesi İstihbarat Platformu — Detaylı Ürün ve Teknik Plan

## Genel yaklaşım

İhtiyaç klasik bir “SEO audit aracı” değildir. Kurulmak istenen yapı:

> 50–100 müşteriye ait siteleri, hiçbir yönetim paneline erişmeden dışarıdan gözlemleyen; teknik, organik görünürlük, içerik, performans, erişilebilirlik, rakip ve reklam fırsatlarını kanıtlarıyla açıklayan bir danışmanlık işletim sistemi.

Geçici adıyla buna **External Website Intelligence Platform** denebilir.

Sistemin en önemli özelliği çok fazla puan üretmesi değil; her sorun için şu zinciri kurması olmalıdır:

```text
Gözlem → Kanıt → Etkilenen kapsam → Muhtemel sonuç
→ Önerilen çözüm → Uygulama örneği → Doğrulama yöntemi
```

## 1. Dışarıdan neleri bilebilir, neleri bilemezsin?

Bunu ürünün temel prensibi hâline getirmek gerekir.

| Sınıf | Örnekler |
|---|---|
| Doğrudan kanıtlanabilir | HTTP yanıtı, HTML, DOM, canonical, robots, sitemap, yönlendirme, kırık link, ekran görüntüsü, yüklenme şelalesi, erişilebilirlik ihlali, belirli konum ve zamanda SERP sırası |
| Güçlü şekilde çıkarılabilir | Tarama verimsizliği, muhtemel keyword cannibalization, rakibin daha kapsamlı içerik sunması, sayfa şablonundaki performans problemi |
| Hipotez olarak sunulabilir | Rakibin neden daha üst sırada olduğu, organik trafik kaybının sebebi, yapılacak değişikliğin sağlayacağı trafik artışı |
| Erişimsizken bilinemez | Gerçek gösterim/tıklama, CTR, Google’ın seçtiği canonical, kesin indeks durumu, manuel işlem, crawl stats, dönüşüm, gelir, reklam harcaması ve ROAS |

Search Console URL Inspection API yalnızca yönetilen Search Console mülkleri için veri verir. Bu nedenle erişimsiz modelde “Google bu URL’yi kesin indeksledi” denmemeli; “harici indeks görünürlüğü gözlendi/gözlenmedi” denmelidir. [Google’ın URL Inspection açıklaması](https://developers.google.com/search/blog/2022/01/url-inspection-api)

Benzer şekilde:

- `site:domain.com` sorgusu kesin indeks sayısı değildir.
- SERP’te URL görülmesi, o sorgu ve o ölçüm anı için güçlü kanıttır.
- SERP’te görülmemesi, URL’nin indekste olmadığı anlamına gelmez.
- GSC olmadan “organik trafik %30 düştü” gibi iddialar üretilmemelidir.
- Rakibin önde olma nedenleri “kanıt destekli hipotez” olarak açıklanmalıdır; Google algoritmasının nedensel açıklaması gibi sunulmamalıdır.

## 2. Sistemin ana modülleri

### 2.1 Portföy ve müşteri yönetimi

Her site bağımsız bir proje olmalıdır.

Proje tanımında:

- Ana domain ve varsa alt domainler
- Marka adı ve marka varyasyonları
- Hedef ülke, şehir ve dil
- Mobil/masaüstü önceliği
- İş modeli: e-ticaret, SaaS, yerel işletme, yayıncı, kurumsal, lead generation
- Ana ürün ve hizmet kategorileri
- Müşterinin belirttiği rakipler
- Sistem tarafından bulunan organik rakipler
- Hedeflenen dönüşümler: form, telefon, WhatsApp, satın alma, kayıt
- Marka dışı önemli konu ve keyword kümeleri
- Tarama limiti ve izin verilen tarama zamanları
- Site için özel önem ağırlıkları

Portföy ekranında:

- En kritik yeni problemler
- Geçen haftadan beri gerileyen siteler
- Teknik sağlık değişimi
- Search visibility değişimi
- Rakiplerin kazandığı keyword kümeleri
- Süresi yaklaşan TLS sertifikaları
- Yeni robots/noindex/canonical değişiklikleri
- Yeni reklam kreatifleri yayınlayan rakipler
- Çözülmüş ve tekrar oluşmuş sorunlar
- Her müşteri için oluşturulmayı bekleyen raporlar

bulunmalıdır.

### 2.2 Dış tarama ve site envanteri

Bu sistemin omurgası güçlü bir crawler olacaktır.

#### URL keşif kaynakları

- Ana sayfa ve dahili linkler
- `robots.txt`
- XML sitemap ve sitemap index dosyaları
- RSS/Atom feed’leri
- `hreflang` hedefleri
- Canonical hedefleri
- Structured data içinde geçen URL’ler
- Sayfalardaki görsel, video, PDF ve dosyalar
- Kamuya açık backlink verisinde bulunan URL’ler
- SERP sonuçlarında görülen URL’ler
- Kullanıcının manuel eklediği önemli URL’ler

Google’ın robots, sitemap, canonical ve crawler davranışlarıyla ilgili kurallarını ayrı ayrı modellemek gerekir. Örneğin robots engeli indeks engeliyle aynı şey değildir; sitemap bir garanti değil sinyaldir. [Google crawling ve indexing dokümantasyonu](https://developers.google.com/search/docs/crawling-indexing)

#### İki seviyeli tarama

**Ucuz HTTP taraması:**

- Durum kodu
- Header’lar
- Redirect zinciri
- HTML
- Linkler
- Metadata
- Canonical
- Robots directives
- Structured data
- İçerik özeti

**Seçici browser rendering:**

- JavaScript ağırlıklı sayfalar
- Ham HTML ile render edilmiş DOM’un farklı olduğu sayfalar
- Kritik şablonlar
- Lighthouse çalıştırılacak sayfalar
- Form ve kullanıcı yolculuğu testleri
- Lazy-loaded içerik ve linkler

Her URL’yi Chromium ile açmak maliyetli ve yavaştır. Önce ucuz tarama yapılmalı; browser rendering yalnızca ihtiyaç olan sayfalarda kullanılmalıdır.

#### Şablon kümeleme

URL’ler tek tek değil, sayfa şablonları olarak sınıflandırılmalıdır:

- Ana sayfa
- Kategori
- Ürün/hizmet
- Blog listeleme
- Blog yazısı
- Lokasyon
- Kampanya/landing page
- İletişim
- Arama/filtre
- Giriş/sepet/ödeme
- Hata sayfaları

DOM fingerprint, URL pattern, başlık yapısı ve içerik bileşenleri kullanılarak şablonlar bulunabilir. Böylece “7.400 URL’de sorun” yerine:

> Ürün detay şablonunun %92’sinde eksik ürün structured data alanı var.

denebilir.

## 3. Kanıta dayalı sorun modeli

Her bulgu aşağıdaki alanları taşımalıdır:

```text
Sorun kimliği
Kategori ve alt kategori
İlk görülme / son görülme
Durum: yeni, devam ediyor, çözüldü, tekrar oluştu
Önem: kritik, yüksek, orta, düşük, bilgi
Güven: kanıtlandı, güçlü çıkarım, hipotez
Etkilenen URL ve şablon sayısı
Örnek URL’ler
Ham kanıt
Render edilmiş kanıt
Ekran görüntüsü
HAR/network kaydı
Test ortamı
Kural ve analiz motoru sürümü
Muhtemel iş etkisi
Önerilen çözüm
Teknolojiye özel uygulama örneği
Kabul/doğrulama kriteri
Tahmini efor
```

### Örnek bulgu

> **Sorun:** Ürün sayfaları kategori sayfasını canonical gösteriyor  
> **Kanıt:** 184/212 ürün URL’si HTTP 200 döndürüyor, sitemap içinde bulunuyor ve dahili link alıyor; fakat render edilmiş DOM’da `rel=canonical` kategori URL’sine gidiyor.  
> **Güven:** Kanıtlandı.  
> **Muhtemel etki:** Ürün URL’lerinin tercih edilen canonical olarak değerlendirilmesini zayıflatabilir. Google’ın gerçekten hangi canonical’ı seçtiği GSC olmadan bilinemez.  
> **Çözüm:** Benzersiz ürün sayfalarında self-referencing canonical kullanılması; varyant politikasının ayrıca tanımlanması.  
> **Doğrulama:** Yeniden taramada canonical’ın 200 dönen, indexable, aynı dil/protokol içindeki ürün URL’sine yönelmesi.

Bu yapı, yalnızca “canonical hatası var” demekten çok daha değerlidir.

## 4. Teknik SEO modülü

### Crawlability ve indexability sinyalleri

- `robots.txt` erişimi, geçerliliği ve kuralları
- Sitemap keşfi, durum kodları ve parse hataları
- Sitemap içinde redirect, 4xx, 5xx veya noindex URL’ler
- Meta robots ve `X-Robots-Tag`
- Googlebot ile genel bot kuralları arasındaki çelişkiler
- CSS/JS gibi render için gerekli kaynakların engellenmesi
- Login, WAF veya bot challenge nedeniyle erişilemeyen içerikler
- Geçici ve kalıcı erişim problemleri

### HTTP ve URL mimarisi

- 3xx zincirleri ve döngüler
- HTTP→HTTPS, www→non-www tutarlılığı
- 4xx/5xx/soft-404 tespiti
- Küçük veya anlamsız 200 sayfalar
- URL parametreleri ve faceted navigation
- Büyük/küçük harf, slash ve query varyasyonları
- Session ID ve tracking parametrelerinin indexable URL üretmesi
- İç linklerin redirect veya hata sayfalarına gitmesi
- Relative/absolute URL problemleri
- Bozuk anchor ve fragment hedefleri

### Canonical analizi

- Eksik canonical
- Birden fazla canonical
- Self-reference tutarlılığı
- Canonical hedefinin 3xx/4xx/5xx/noindex olması
- Canonical zinciri ve döngüsü
- HTTP/HTTPS veya dil çelişkisi
- Sitemap–canonical–dahili link çelişkisi
- Farklı içeriklerin aynı canonical’a gönderilmesi
- Duplicate içerik grupları ve seçilen canonical adayları

Google’a göre redirect ve `rel=canonical` güçlü, sitemap ise daha zayıf bir canonical sinyalidir. [Google canonical rehberi](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)

### Dahili link ve site mimarisi

- Crawl depth
- Inlink/outlink sayıları
- Dahili PageRank benzeri link değeri
- Yalnızca footer’dan link alan önemli sayfalar
- Breadcrumb yapısı
- Hub–cluster ilişkileri
- Click depth ile iş önemi çelişkisi
- Anchor text kalitesi
- Aynı hedefe tutarsız anchor kullanımı
- Kırık ve redirect olan dahili linkler
- Sitemap’te olup taramada bulunmayan URL’ler
- Tarama sırasında bulunan ancak sitemap’te olmayan indexable URL’ler

“Orphan page” sözü dikkatli kullanılmalıdır. Dışarıdan yalnızca sitemap, backlink veya SERP aracılığıyla keşfedilen fakat crawl içinde link almayan URL’ye “gözlemlenen kaynaklarda dahili link bulunamadı” denebilir. Bilinmeyen URL’lerin yokluğu kanıtlanamaz.

### International SEO

- `hreflang` geçerliliği
- Karşılıklı hreflang eksikliği
- Dil/ülke kodu hataları
- `x-default`
- Canonical ile hreflang çelişkisi
- Farklı dil URL’lerinin aynı canonical’a gitmesi
- HTML `lang` değeri
- İçerik diliyle URL/metadata dili uyuşmazlığı
- Otomatik yönlendirme ve coğrafi engelleme

### On-page SEO

- Title ve meta description
- Eksik, duplicate, çok kısa veya aşırı uzun metadata
- H1–H6 yapısı
- Sayfa konusu–title–H1 uyumu
- Search intent ve içerik türü uyumu
- Görsel alt metinleri
- Link metinleri
- Ana içerik ile boilerplate oranı
- Duplicate ve near-duplicate içerik
- İnce içerik
- Güncellik sinyalleri
- Yazar, editör, kaynak ve kurumsal güven sinyalleri
- İletişim, hakkımızda, iade, teslimat ve politika sayfaları
- E-ticarette fiyat, stok, varyant ve ürün kimliği tutarlılığı

### Structured data

- JSON-LD, Microdata ve RDFa keşfi
- Syntax ve schema.org doğrulaması
- Google’ın desteklediği türlerde gerekli/önerilen alanlar
- Sayfa türüyle schema türünün uyumu
- Görünür içerikle markup arasındaki farklar
- Product, Organization, LocalBusiness, Article, Breadcrumb, FAQ, Video gibi türler
- Duplicate entity ve yanlış `@id` kullanımı
- Fiyat/stok/tarih uyuşmazlığı
- Render öncesi ve sonrası markup farkı

Geçerli structured data zengin sonuç gösterileceği anlamına gelmez. Google da uygunluğun görünüm garantisi olmadığını açıkça belirtir. [Google structured data yönergeleri](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)

## 5. Performance ve Core Web Vitals

### Laboratuvar ve gerçek kullanıcı verisini ayır

#### Lab verisi

Kendi kontrollü Lighthouse/Chrome worker’ların üzerinden:

- LCP
- CLS
- TBT
- FCP
- Speed Index
- TTFB
- Render-blocking kaynaklar
- Kullanılmayan JS/CSS
- Main thread işleri
- Büyük DOM
- Görsel optimizasyonu
- Cache politikaları
- Font yükleme
- Üçüncü taraf script maliyeti
- Network waterfall
- LCP element ve resource breakdown
- Layout shift nedenleri

Ölçümler:

- Mobil ve masaüstü
- En az üç tekrar
- Median değer
- Sabit Lighthouse/Chrome sürümü
- Sabit ağ/CPU profili
- Mümkünse birden fazla bölge

üzerinden yapılmalıdır.

#### Field verisi

CrUX erişilebiliyorsa URL ve origin düzeyinde kullanılmalıdır. CrUX, 28 günlük kayan gerçek kullanıcı verisi sağlar; veri bulunmaması kötü performans anlamına değil, yeterli örnek olmamasına işaret edebilir. [CrUX API veri modeli](https://developer.chrome.com/docs/crux/api)

Güncel iyi eşikler:

- LCP ≤ 2,5 saniye
- INP ≤ 200 ms
- CLS ≤ 0,1
- Değerlendirme p75 üzerinden

yapılır. [Core Web Vitals açıklaması](https://web.dev/articles/vitals)

### Performans teşhisi

Sadece “LCP kötü” demek yerine:

- LCP elementi ne?
- Sunucu cevabı mı geç?
- Görsel keşfi mi geç?
- Görsel yükleme süresi mi uzun?
- Element render gecikmesi mi var?
- Cookie banner veya slider CLS oluşturuyor mu?
- Tag Manager ve reklam scriptleri main thread’i ne kadar bloke ediyor?
- Problem hangi şablonlarda görülüyor?
- Rakip aynı şablonda nasıl davranıyor?

gösterilmelidir.

## 6. Accessibility

Hedef standardı **WCAG 2.2 AA** yapılabilir. W3C, WCAG 2.2’nin test edilebilir başarı kriterlerinden oluştuğunu ve 2.1’e dokuz yeni kriter eklediğini belirtir. [WCAG 2.2 standardı](https://www.w3.org/TR/WCAG22/)

### Otomatik kontroller

- Renk kontrastı
- Form label’ları
- Accessible name
- ARIA geçerliliği
- Duplicate ID
- Görsel alt metinleri
- Heading sırası
- Landmark bölgeleri
- Link/button ayrımı
- Dil tanımı
- Viewport ve zoom engelleri
- Tabindex hataları
- Dialog ve modal yapıları
- Target size
- Video caption sinyalleri

### Browser tabanlı kontroller

- Klavyeyle ana menü
- Focus görünürlüğü
- Focus trap
- Skip link
- Modal açma/kapatma
- Menü ve accordion davranışı
- Form hata mesajları
- Cookie banner erişilebilirliği
- Mobil dokunma alanları

Otomatik araçlar WCAG uyumluluğunu kesin olarak kanıtlayamaz. Rapor üç gruba ayrılmalıdır:

- Otomatik olarak kanıtlanan ihlaller
- Manuel doğrulama gerektiren şüpheler
- Danışman tarafından tamamlanan manuel testler

## 7. Best practices, güvenlik ve gizlilik

Bu modül pasif ve zararsız olmalı; müşterinin açık izni olmadan exploit, brute force veya aktif zafiyet taraması yapmamalıdır.

### Pasif güvenlik sinyalleri

- HTTPS ve TLS sertifika durumu
- Sertifika bitiş tarihi
- Mixed content
- HSTS
- CSP ve CSP Report-Only farkı
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy
- Frame koruması
- Cookie `Secure`, `HttpOnly`, `SameSite`
- Açık server/framework sürümü
- Güvensiz form action
- HTTP üzerinden hassas form
- Subresource Integrity fırsatları
- Kamuya açık source map ve debug izleri
- Bilinen risk taşıyan frontend kütüphaneleri
- DNSSEC, CAA
- SPF, DKIM ve DMARC gibi domain güven sinyalleri

Sadece header’ın bulunması yeterli değildir; örneğin aşırı izinli CSP etkisiz olabilir. [OWASP security header test yaklaşımı](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/14-Test_Other_HTTP_Security_Header_Misconfigurations)

### Cookie ve privacy incelemesi

Yeni bir browser profiliyle:

1. Sayfa açılmadan önceki depolama durumu
2. İlk sayfa yüklemesinde gönderilen üçüncü taraf istekleri
3. Kullanıcı herhangi bir seçim yapmadan oluşan cookie/localStorage kayıtları
4. “Reddet” sonrasındaki durum
5. “Kabul et” sonrasındaki durum
6. Tercihlerin daha sonra değiştirilebilirliği

karşılaştırılabilir.

Kontroller:

- CMP varlığı
- Kabul ve reddet seçeneklerinin dengesi
- Zorunlu olmayan tracker’ların izin öncesi çalışması
- Google/Meta/TikTok/Hotjar vb. tag varlığı
- Privacy policy linkleri
- Form aydınlatma ve checkbox yapıları
- UTM veya query string içinde kişisel veri riski

Bu sonuçlar “hukuka aykırı” şeklinde otomatik hüküm vermemeli; “hukuki inceleme gerektiren teknik sinyal” olarak sunulmalıdır. KVKK’nın resmî çerez rehberi de çerezlerle kişisel veri işleme ve açık rıza uygulamaları için temel kaynak olmalıdır. [KVKK Çerez Uygulamaları Rehberi](https://www.kvkk.gov.tr/Icerik/7353/Cerez-Uygulamalari-Hakkinda-Rehber)

## 8. Keyword ve search visibility sistemi

### Keyword evreni

Her site için keyword’ler şu kaynaklardan üretilebilir:

- Kullanıcının girdiği seed keyword’ler
- Sitedeki title, heading ve içerik
- Ürün/hizmet isimleri
- Rakiplerin sıralandığı sorgular
- SERP’teki related searches ve soru kalıpları
- Google Keyword Planner verisi
- Google Trends
- Mevcut URL’lerin konuları
- Şehir, sektör, problem ve çözüm kombinasyonları

Google Ads Keyword Plan API kullanmak için platformun kendi Google Ads manager hesabı, developer token’ı ve “keyword research” kullanım izni gerekir; müşterinin GSC erişimi gerekmez. [Google Ads API erişim seviyeleri](https://developers.google.com/google-ads/api/docs/api-policy/access-levels)

Google Trends’in resmî API’si hâlen sınırlı alpha erişim modelindedir; bunun için ayrı başvuru/fallback planı bulunmalıdır. [Google Trends API Alpha](https://developers.google.com/search/apis/trends)

### Keyword kayıt yapısı

Her keyword:

- Dil
- Ülke
- Şehir/konum
- Cihaz
- Arama niyeti
- Huni aşaması
- Konu kümesi
- Tahmini hacim
- CPC ve rekabet
- Trend
- Sezon
- Marka/marka dışı
- Hedef URL
- Mevcut sıralama
- Rakip sıralamaları
- SERP özellikleri
- Son kontrol tarihi
- Veri kaynağı ve güven seviyesi

taşımalıdır.

### Keyword clustering

İki yöntem birlikte kullanılmalıdır:

- Semantik benzerlik
- Aynı SERP sonuçlarını paylaşma oranı

Sadece embedding’e göre kümelemek hatalı olabilir. Anlamca benzer görünen iki sorgu Google’da farklı intent gösterebilir.

### Visibility hesabı

Basit ortalama sıra yerine:

```text
Keyword katkısı =
arama hacmi × tahmini CTR × SERP sahiplik oranı × veri güveni
```

```text
Search Visibility =
site katkılarının toplamı / ölçülebilir maksimum katkı
```

Raporlar:

- Top 3, Top 10, Top 20
- Marka/marka dışı
- Mobil/masaüstü
- Ülke/şehir
- Konu kümesi
- Kazanan/kaybeden URL
- Rakibe kaybedilen keyword
- Featured snippet, local pack, image, video, shopping, AI sonucu gibi SERP özellikleri
- Yeni giriş ve tamamen kaybolma
- Ranking volatility

Google sonuçlarını doğrudan otomatik scrape etmek yerine sözleşmeli/lisanslı bir SERP veri sağlayıcısı kullanılmalıdır. Google, izinsiz otomatik sorguları ve rank-checking amaçlı scraping’i politikalarına aykırı sayıyor. [Google machine-generated traffic politikası](https://developers.google.com/search/docs/essentials/spam-policies#machine-generated-traffic)

## 9. Rakip sistemi

Rakipler üç farklı türde tutulmalıdır:

- **İş rakibi:** Müşterinin gerçek pazardaki rakibi
- **Organik rakip:** Aynı keyword’lerde görünen domain
- **İçerik rakibi:** Satış yapmasa bile SERP alanını alan yayıncı, rehber veya platform

Her rakip için:

- Keyword overlap
- Share of voice
- Kazandığı konu kümeleri
- Sıralanan URL tipleri
- İçerik derinliği ve kapsadığı alt konular
- Dahili link mimarisi
- Structured data
- CWV ve performans
- Backlink ve referring domain verileri
- Marka güven sinyalleri
- İçerik güncelliği
- SERP feature sahipliği
- Reklam kreatifleri ve landing page’ler
- Fiyat, teklif, CTA ve değer önerileri

karşılaştırılmalıdır.

### “Rakip neden önde?” açıklaması

Sistem kesin sebep iddia etmemelidir. Bunun yerine faktör bazında kanıt tablosu üretmelidir:

| Faktör | Biz | Rakip | Kanıt | Güven |
|---|---:|---:|---|---|
| Search intent uyumu | Zayıf | Güçlü | Rakip kategori sayfası; biz blog yazısı ile sıralanıyoruz | Güçlü çıkarım |
| Konu kapsamı | 6 alt başlık | 18 alt başlık | Render edilmiş içerik karşılaştırması | Kanıtlandı |
| Dahili link | 4 | 37 | Crawl graph | Kanıtlandı |
| Referring domain | 22 | 164 | Harici backlink sağlayıcısı | Sağlayıcı tahmini |
| LCP p75 | 4,1 sn | 2,2 sn | CrUX origin verisi | Kanıtlandı |
| Google’ın sıralama nedeni | Bilinemez | Bilinemez | Birinci taraf algoritma verisi yok | — |

Sonuç şöyle olmalıdır:

> Rakibin önde olmasını tek başına açıklayamayız; ancak intent uyumu, konu kapsamı, dahili link desteği ve harici otorite göstergelerinde ölçülebilir avantajı bulunuyor.

## 10. Google Ads Studio

Müşteri Ads hesabına erişmeden yapılabilecek şey “reklam performans optimizasyonu” değil, **kampanya stratejisi ve üretim stüdyosu**dur.

### Üretilecek çıktılar

- Kampanya ve ad group yapısı
- Keyword kümeleri
- Match type önerileri
- Negatif keyword listeleri
- Marka/marka dışı ayrımı
- RSA başlık ve açıklama varyantları
- Sitelink, callout, structured snippet önerileri
- Landing page eşleştirmesi
- Keyword–reklam–landing page message match kontrolü
- Lokasyon ve zamanlama hipotezleri
- Teklif stratejisi için koşullu öneriler
- Kampanya isimlendirme standardı
- UTM şablonları
- CSV veya Google Ads Editor’a uygun export
- Politika riski taşıyan ifadeler
- A/B test hipotezleri

### Rakip reklam incelemesi

Google Ads Transparency Center, doğrulanmış reklamverenlerin yayınladığı reklamları, bölgeyi, formatı ve son gösterim tarihini kamuya açık biçimde gösterebilir. [Google Ads Transparency Center açıklaması](https://blog.google/innovation-and-ai/technology/ads/announcing-the-launch-of-the-new-ads-transparency-center/)

Ancak bunu resmî bir sınırsız bulk API gibi varsaymamak gerekir. İlk sürümde:

- Danışmanın doğruladığı reklamveren kaydı
- Kamuya açık bağlantı ve kreatif arşivi
- Manuel veya sözleşmeli veri connector’ı
- Kreatif değişim takibi

yaklaşımı daha güvenlidir.

“Rakip şu keyword’e şu kadar harcıyor” gibi kanıtsız tahminlerden kaçınılmalıdır.

## 11. Meta Ads Studio

### Kamuya açık rakip analizi

Meta Ad Library üzerinden aktif reklamlar görülebilir; sosyal/politik reklamlarda daha geniş geçmiş ve ek bilgiler bulunur. [Meta Ad Library açıklaması](https://www.facebook.com/help/259468828226154)

Her rakip kreatifi için:

- Başlangıç tarihi
- Aktif/pasif durum
- Görsel/video formatı
- Hook
- Problem
- Vaat
- Sosyal kanıt
- Teklif
- CTA
- Landing page
- Kreatif açı
- Funnel aşaması
- Kreatif yorgunluğu için süre göstergesi
- Aynı fikrin varyantları

etiketlenebilir.

### Üretim stüdyosu

- Kampanya amacı önerileri
- TOF/MOF/BOF kreatif planı
- Persona değil, ihtiyaç ve kullanım senaryosu temelli açı
- Primary text
- Headline
- Description
- CTA
- Görsel/video brief
- UGC senaryosu
- 15/30/60 saniyelik video storyboard
- Hook varyantları
- Teklif ve itiraz karşılama
- Landing page uyumu
- UTM yapısı
- Test matrisi

Örneğin sistem tek seferde 40 rastgele metin üretmemelidir. Şöyle kontrollü bir deney tasarlamalıdır:

```text
3 değer önerisi × 3 hook × 2 format × 2 CTA = 36 varyant
```

Her varyantın hangi hipotezi test ettiği belirtilmelidir.

Müşteri hesabı olmadan pixel’in sayfada bulunması tespit edilebilir; doğru çalıştığı, event kalitesi, attribution veya ROAS bilinemez.

## 12. Eklenmesi gereken diğer önemli modüller

### CRO ve kullanıcı yolculuğu

- CTA görünürlüğü ve tutarlılığı
- Form alanı sayısı
- Form label ve hata durumları
- Mobil form kullanılabilirliği
- Telefon/WhatsApp linkleri
- Sepet veya lead yolculuğundaki kırık adımlar
- Fiyat ve teslimat belirsizlikleri
- Güven işaretleri
- Popup ve interstitial müdahaleleri
- Empty state ve 404 deneyimi

Bunlar otomatik “dönüşüm artırır” iddiasıyla değil, test edilebilir CRO hipotezleri olarak sunulmalıdır.

### Local SEO

- Kamuya açık Google Business Profile görünürlüğü
- NAP tutarlılığı
- Kategori ve hizmet kapsamı
- Review hacmi, güncelliği ve tema analizi
- Lokasyon landing page’leri
- LocalBusiness structured data
- Harita sonuçlarında konum bazlı ölçüm
- Spam ihtimali taşıyan rakip profilleri için manuel inceleme

### Backlink ve off-page

Backlink verisi kendi crawler’ınla gerçekçi biçimde oluşturulamaz; harici bir veri sağlayıcı gerekir.

- Referring domain
- Follow/nofollow
- Yeni/kaybolan link
- Anchor dağılımı
- Rakip link gap
- Kırık backlink hedefleri
- 404’e gelen değerli linkler
- Marka mention’ları
- Toxic score yerine açık risk sinyalleri

“Zararlı backlink” otomatik kesin hüküm olarak verilmemelidir.

### Marka ve içerik bütünlüğü

- Logo/favicon/Open Graph eksiklikleri
- Marka adı ve iletişim bilgisi tutarsızlığı
- Sosyal preview
- Yanlış yıl, fiyat veya stok
- Eski kampanya sayfaları
- Bozuk PDF ve medya
- Yazar profilleri
- Kaynaksız sağlık/finans/hukuk iddiaları
- İçerik decay ve güncellik ihtiyacı

### AI/GEO görünürlüğü

Daha sonraki aşamada:

- Marka ve kategori sorularının farklı cevap motorlarında örneklenmesi
- Marka citation/mention takibi
- Hangi kaynakların referans verildiği
- Entity ve konu tutarlılığı
- Açık, alıntılanabilir cevap blokları
- İstatistik ve kaynak kalitesi
- AI crawler erişim kuralları

eklenebilir.

Ancak AI sonuçları kişiselleşebilir ve değişkendir; “AI visibility” her zaman zaman, model, konum ve prompt setiyle birlikte raporlanmalıdır.

## 13. Skor ve önceliklendirme

Tek bir 0–100 puan güvenilir değildir. En az şu değerler ayrı gösterilmelidir:

- Technical Health
- Search Visibility
- Content Opportunity
- Performance
- Accessibility
- Security Hygiene
- Privacy Signals
- Ads Readiness
- Measurement Confidence
- Crawl Coverage

Önerilen öncelik formülü:

```text
Öncelik =
kanıt güveni
× iş etkisi
× iş açısından ağırlıklandırılmış kapsam
× fırsat
÷ tahmini efor
```

URL sayısı doğrudan kapsam olmamalıdır. Örneğin 50.000 filtre URL’sindeki düşük etkili sorun, 12 ana ürün sayfasındaki satın alma engelinden daha önemli görünmemelidir.

Her öneri ayrıca şu matrisle sunulabilir:

- Quick win
- Büyük proje
- İzlenmeli
- Düşük değer
- Manuel doğrulama gerekli
- Müşteri verisi olmadan doğrulanamaz

## 14. Tarama ve izleme takvimi

100 site için önerilen düzen:

### Her 5–15 dakika

- Uptime
- Ana sayfa ve kritik URL durum kodları
- TLS sertifika süresi

### Günlük

- `robots.txt`
- Sitemap erişimi
- Ana sayfa noindex/canonical
- Kritik şablonların görsel ve DOM değişimi
- Güvenlik ve yönlendirme değişiklikleri

### Haftalık

- Delta crawl
- Önemli keyword rank ölçümü
- Rakip visibility değişimi
- Kritik template Lighthouse
- Yeni/kaybolan reklam kreatifleri
- Broken journey testleri

### Aylık

- Tam crawl
- Geniş keyword seti
- CrUX karşılaştırması
- Backlink değişimleri
- İçerik gap
- Rakip benchmark
- Yönetici raporu

### Üç aylık

- Derin erişilebilirlik
- Manuel UX/CRO incelemesi
- Reklam stratejisi
- Keyword evreninin yeniden oluşturulması
- Müşteri hedefleri ve rakip listesinin gözden geçirilmesi

## 15. Ölçek hesabı

Örnek kapasite:

```text
100 site × ortalama 2.000 URL = 200.000 URL/ay
%10 browser rendering = 20.000 render/ay
5 şablon × 2 cihaz × 3 tekrar × 100 site
= 3.000 Lighthouse çalışması/ay

300 keyword × 100 site × haftalık ölçüm
= 30.000 SERP kontrolü/hafta
= yaklaşık 120.000 kontrol/ay
```

Asıl maliyetler:

1. SERP sorguları
2. Backlink veri sağlayıcısı
3. Browser/Lighthouse CPU
4. Reklam kreatif arşivi
5. Ekran görüntüsü, HTML ve HAR depolama
6. LLM analizi

Normal HTML crawl nispeten ucuzdur. Rank tracking ve backlink verisi maliyetin önemli bölümünü oluşturur.

## 16. Teknik mimari

```text
Scheduler
   ↓
Job Queue
   ├── DNS/HTTP Worker
   ├── Crawler Worker
   ├── Browser/Playwright Worker
   ├── Lighthouse Worker
   ├── Accessibility Worker
   ├── SERP/Keyword Connector
   ├── Backlink Connector
   └── Ads Intelligence Connector
             ↓
        Normalization
             ↓
   Deterministic Rules Engine
             ↓
      Evidence & Issue Store
             ↓
       AI Explanation Layer
             ↓
 Dashboard / Report / Export
```

### Önerilen altyapı

- PostgreSQL: müşteri, proje, issue ve konfigürasyon
- Object storage: HTML, screenshot, HAR, Lighthouse JSON
- Redis veya message broker: kuyruk
- Playwright/Chromium: rendering
- Lighthouse: kontrollü performance
- axe-core benzeri motor: accessibility
- ClickHouse veya time-series yapı: rank ve ölçüm geçmişi
- Worker autoscaling
- Tenant bazlı veri izolasyonu

### Temel veri varlıkları

- `tenant`
- `project`
- `domain`
- `crawl_run`
- `url`
- `page_snapshot`
- `template_cluster`
- `observation`
- `issue`
- `evidence`
- `recommendation`
- `keyword`
- `keyword_cluster`
- `rank_observation`
- `serp_snapshot`
- `competitor`
- `ad_creative`
- `report`

### Kritik güvenlik önlemi: SSRF

Kullanıcıların URL girebildiği crawler sistemleri ciddi SSRF riski taşır. Mutlaka:

- Private ve link-local IP’leri engelleme
- DNS rebinding koruması
- Her redirect sonrasında IP doğrulama
- Sadece HTTP/HTTPS
- Dosya ve response boyutu limiti
- Browser sandbox
- Ayrı ağ
- Metadata endpoint engeli
- Tenant ve secret izolasyonu

uygulanmalıdır.

## 17. Yapay zekânın doğru rolü

LLM:

- Kanıtları anlaşılır dile çevirmeli
- Sorunu müşterinin teknoloji yığınına göre açıklamalı
- Kod/config örneği üretmeli
- Benzer sorunları birleştirmeli
- Rakip farklarını özetlemeli
- Reklam ve içerik brief’i üretmeli
- Yönetici ve geliştirici için ayrı rapor yazmalı

Fakat LLM:

- Tarama yapılmadan sorun üretmemeli
- Bilinmeyen trafik veya gelir rakamı uydurmamalı
- “Google ceza vermiş” dememeli
- Her korelasyonu nedensellik gibi açıklamamalı
- Kendi oluşturduğu tavsiyeyi kanıt gibi göstermemeli

En sağlıklı model:

```text
Deterministik motor problemi bulur
→ Evidence store kanıtı saklar
→ LLM açıklama ve çözüm üretir
→ Claim validator her iddiayı kanıta bağlar
```

## 18. Danışmanlık iş akışı

Her issue için:

```text
Yeni → Danışman incelemesi → Onaylandı
→ Müşteriye gönderildi → Uygulanıyor
→ Yeniden test → Çözüldü / Devam ediyor / Regresyon
```

İlave durumlar:

- Yanlış pozitif
- Kabul edilen risk
- Müşteri verisi gerekli
- Erişim engellendi
- Başka issue ile birleştirildi
- Planlandı
- İzleniyor

Rapor türleri:

- Yönetici özeti
- Teknik ekip raporu
- SEO içerik raporu
- Rakip fırsat raporu
- Google Ads brief
- Meta kreatif brief
- Aylık değişim raporu
- Before/after doğrulama raporu
- White-label PDF ve paylaşılabilir canlı rapor

## 19. Geliştirme yol haritası

### Faz 0 — Ürün tanımı, 2 hafta

- Issue ve evidence şeması
- Erişimsiz modelin sınırları
- Beş farklı site türünde örnek analiz
- Crawl politikası
- İlk 50 deterministik kural
- SERP/backlink sağlayıcı değerlendirmesi

### Faz 1 — Temel platform, 4–6 hafta

- Portföy ve site projeleri
- Scheduler ve worker altyapısı
- HTTP crawler
- Sitemap/robots
- URL normalization
- HTML snapshot
- Issue lifecycle
- İlk dashboard

### Faz 2 — Derin denetim, 5–7 hafta

- Browser rendering
- Template clustering
- Teknik SEO kuralları
- Lighthouse ve CrUX
- Accessibility
- Screenshot/HAR kanıtları
- Değişim ve regresyon tespiti
- PDF rapor

### Faz 3 — Search intelligence, 4–6 hafta

- Keyword sistemi
- SERP connector
- Visibility hesabı
- Keyword clustering
- Competitor discovery
- Content gap
- Rank alertleri

### Faz 4 — Ads ve strateji, 4–5 hafta

- Google Ads Studio
- Meta Ads Studio
- Rakip kreatif kütüphanesi
- Landing page/message match
- Export şablonları
- İnsan onaylı üretim akışı

### Faz 5 — Ölçek ve kalite, 3–5 hafta

- 100 site yük testi
- Cost controls
- Crawl scheduling
- False-positive ölçümü
- Rule/version migration
- Tenant güvenliği
- İzleme ve hata kurtarma

Gerçekçi şekilde güçlü bir MVP yaklaşık **10–14 haftada**, tarif edilen kapsamın olgun ilk sürümü ise ekip büyüklüğüne göre **5–7 ayda** ortaya çıkar.

## 20. İlk MVP’de bulunması gerekenler

İlk sürümü aşırı genişletmemek için şunlarla başlamak en mantıklısıdır:

1. Portföy ve site yönetimi
2. HTTP + seçici browser crawler
3. Sitemap, robots, canonical, status, metadata, internal link ve structured data
4. Template clustering
5. Lighthouse + CrUX
6. Accessibility otomasyonu
7. Kanıt paketli issue sistemi
8. Keyword/rank tracking
9. Üç rakibe kadar karşılaştırma
10. Search visibility
11. AI destekli fakat kanıta bağlı çözüm metinleri
12. White-label aylık rapor
13. Değişim ve regresyon alarmı

Google/Meta Ads Studio, backlink intelligence, local SEO ve AI visibility ikinci dalgada eklenebilir.

En kritik ürün kararı şudur: sistem “çok şey ölçen bir dashboard” olmamalıdır. Danışmana her hafta şu üç sorunun cevabını vermelidir:

1. **Ne değişti?**
2. **Bunun kanıtı nedir?**
3. **Önce ne yapılmalı ve düzeltildiğini nasıl doğrularız?**

Bunu doğru kurarsan Search Console erişimin olmaması ürünün zayıflığı değil, doğrudan ürün konumlandırması olur: **bağımsız, dışarıdan doğrulanabilir ve müşterinin altyapısına dokunmayan denetim sistemi.**
