# Uygulama ve Üretim Durumu

Bu belge kod tabanının mevcut durumunu dürüstçe kaydeder. Bir özelliğin ekranda görünmesi, dış veri sağlayıcısının etkin olduğu anlamına gelmez. GSC, Analytics, DNS veya reklam hesabı verisi hiçbir yerde dış gözlem gibi sunulmaz.

## Tamamlanan ürün yetenekleri

- Çok kiracılı portföy, kullanıcı, rol ve opak oturum modeli
- PostgreSQL kalıcılığı, tenant transaction bağlamı ve satır seviyesi güvenlik
- Redis/BullMQ audit kuyruğu, tekrar deneme, zamanlama ve dağıtık scheduler kilidi
- SSRF korumalı, DNS/IP sabitlemeli, redirectleri yeniden doğrulayan dış crawler
- `robots.txt`, sitemap ve aynı-origin BFS keşfi; crawl-delay ve kaynak limitleri
- Quick, standard ve deep audit profilleri
- Playwright render, aynı-origin kaynak politikası, ekran görüntüsü ve axe ölçümü
- Şifre/form gönderimi yapmayan, adım başına görsel kanıt üreten güvenli sentetik kullanıcı yolculukları
- Sıkıştırılmış HTML, checksum ve S3/MinIO kanıt nesneleri
- Observation, evidence, inference, impact, recommendation ve verification alanlarının ayrı saklanması
- Deterministik SEO, HTTP, erişilebilirlik ve pasif güvenlik kuralları
- Başlık, description, canonical, robots, H1, schema, CTA, durum kodu ve üçüncü taraf değişiklik zaman çizelgesi
- İçerik, structured data, erişilebilirlik, gizlilik, uyumluluk, sürdürülebilirlik, reklam ve güven istihbaratı merkezi
- MX, SPF, DMARC, CAA, TLS sertifika süresi ve `security.txt` için pasif dış gözlemler
- Opsiyonel CrUX API ile origin/telefon alan verisi; API anahtarı yokken açıkça “ölçülmedi” durumu
- Issue lifecycle: açık, inceleniyor, kabul edilen risk, yanlış pozitif, çözüldü ve regression
- Keyword, rakip, rank observation ve ölçülmüş search visibility geçmişi
- Generic lisanslı SERP sağlayıcı adaptörü; sağlayıcı yokken “ölçülmedi” durumu
- Kanıta referans veren Google/Meta reklam brief çalışma alanı
- PDF rapor, yetkili indirme, token-hash tabanlı public paylaşım ve iptal
- Apple/iOS esintili responsive arayüz; klavye, focus, empty/loading/error ve reduced-motion durumları
- Production Docker imajları, ayrı migration işi, health check, Redis auth ve internal ağlar
- Tailscale `100.104.207.55:8080` için tek komutlu home-server Compose, otomatik migration/bootstrap/bucket ve yedek betiği

## Ölçüm sınırları

- Performance skoru şu anda Playwright yükleme süresinden üretilen **Evidera lab heuristic** değeridir; Lighthouse veya alan verisi değildir.
- Erişilebilirlik skoru render edilen sınırlı örnek sayfalardaki axe ihlallerinden türetilir; manuel WCAG uygunluk belgesi değildir.
- Visibility sadece yapılandırılmış SERP sağlayıcısının gerçekten topladığı rank observation kayıtlarından hesaplanır.
- Reklam briefleri kampanya performansı iddia etmez. Dış sayfa kanıtı, anahtar kelime ve danışman hipotezlerini düzenler.
- Backlink, Google Ads ve Meta Ad Library için ortam değişkenleri hazırlıdır; lisanslı sağlayıcı sözleşmesi verilmeden hesap/sağlayıcı verisi üretilmez. CrUX adaptörü mevcuttur ancak yalnızca `CRUX_API_KEY` verilirse ölçüm yapar.
- Harici gözlem dönüşüm, trafik, gelir, indekslenme veya reklam hesabı sonucu kanıtlayamaz.

## Home-server çalışma profili

- Yalnızca web servisi Tailscale IP’sine açılır; PostgreSQL, Redis ve MinIO yalnızca internal Docker ağındadır.
- `.env.homeserver` gerçek, rastgele üretilmiş secret’ları içerir, `0600` iznindedir ve Git tarafından izlenmez.
- `./scripts/homeserver-up.sh` önkoşulları ve Tailscale IP atamasını denetler; `8080` doluysa güvenli aralıktan boş port seçer, imajları build edip hazır olana kadar bekler.
- Home-server MinIO profili KMS kullanmadığı için uygulama katmanı SSE kapalıdır; fiziksel disk/volume şifrelemesi gereklidir.
- Veritabanı yedeği `./scripts/homeserver-backup.sh` ile `backups/` altında izinleri kısıtlı PostgreSQL custom dump olarak alınır.

## Üretime alma öncesi dış operasyonlar

Bunlar kodun kendi başına tamamlayamayacağı ortam ve kurum kararlarıdır:

1. Gerçek domain, TLS sonlandırma, WAF/reverse proxy ve güvenilir proxy aralıklarını belirleyin.
2. Tüm örnek parolaları güçlü secret manager değerleriyle değiştirin; cookie secure modunu açın.
3. S3 bucket lifecycle, object retention, yedekleme, PostgreSQL PITR ve geri yükleme tatbikatını kurun.
4. E-posta/SSO veya davet akışını kurum kimlik sağlayıcısıyla bağlayın; bootstrap seed’i kapatın.
5. Lisanslı SERP sözleşmesini ve bölge/dil maliyet sınırlarını tanımlayın. İsteniyorsa CrUX/backlink/ad-library adaptörlerini sağlayıcı sözleşmesine göre ekleyin.
6. Crawler kimlik sayfasını yayınlayın; abuse adresi, opt-out ve müşteri yetkilendirme kayıt politikasını belirleyin.
7. Merkezi log, alarm, uptime, queue-depth, disk/bucket ve veritabanı metriklerini kurum gözlemleme sistemine bağlayın.
8. Beklenen site/sayfa hacmiyle yük testi yapın; worker concurrency, crawl bütçesi ve tenant kotalarını sonuçlara göre ayarlayın.
9. Veri saklama/silme süreleri, KVKK/GDPR DPA, rapor paylaşım süresi ve müşteri sözleşmesi onayını tamamlayın.
10. Staging üzerinde migration ileri/geri alma, felaket kurtarma ve key rotation runbook’larını prova edin.

## Doğrulama kapıları

Her teslimde aşağıdakiler başarılı olmalıdır:

```bash
npm run lint
npm run typecheck
npm test
npm run build
docker compose -f compose.production.yml config -q
```

## Ölçüm dili

- **Kanıtlandı:** sistemin doğrudan ve tekrarlanabilir biçimde gözlemlediği durum.
- **Güçlü çıkarım:** kanıtla desteklenen fakat nedenselliği doğrulanmamış yorum.
- **Hipotez:** kontrollü deney veya hesap içi veriyle test edilmesi gereken öneri.
- **Bilinemez:** GSC, Analytics, Ads veya sunucu logu olmadan doğrulanamayacak sonuç.
