# Evidera

Evidera; DNS, Search Console, Analytics veya reklam hesabı erişimi olmadan çalışan, kanıt odaklı dış web sitesi istihbarat platformudur. Her bulgu gözlem, kanıt, çıkarım sınırı, etki, öneri ve doğrulama adımını ayrı tutar.

Ayrıntılı ürün/mimari planı [dis-web-sitesi-istihbarat-platformu-plani.md](./dis-web-sitesi-istihbarat-platformu-plani.md), güncel üretim matrisi [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) dosyasındadır.

## Mimari

```text
apps/web             React + Vite danışman paneli
apps/api             Fastify API, auth, RBAC ve rapor servisleri
apps/worker          BullMQ crawler/render/rank scheduler worker’ı
packages/contracts   Ortak API sözleşmeleri
packages/crawler     Güvenli fetch, keşif ve deterministik analyzer
packages/database    Drizzle şeması, migration ve tenant transaction’ları
packages/runtime     Ortam doğrulama ve paylaşılan runtime sözleşmeleri
infra                PostgreSQL runtime rolü ve altyapı başlangıç dosyaları
```

## Yerel kurulum

Gereksinimler: Node.js 22+, npm ve Docker.

```bash
cp .env.example .env
docker compose up -d postgres redis minio
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

Web `http://localhost:4173`, API `http://127.0.0.1:4100` adresindedir. Worker ayrı terminalde başlatılabilir:

```bash
npm run dev:worker
```

Bootstrap hesabı yalnızca açıkça çalıştırılan `db:seed` komutunda ve `.env` içindeki değerlerle oluşturulur. Üretimde seed kullanılmamalıdır.

## Kalite kapıları

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

## Üretim

`.env.example` temel değişkenleri belgeler. Üretimde en az iki ayrı PostgreSQL parolası kullanılır: migration sahibi (`POSTGRES_ADMIN_PASSWORD`) ve RLS’ye tabi, superuser olmayan runtime rolü (`APP_DATABASE_PASSWORD`). `DATABASE_URL` runtime rolünü göstermelidir.

```bash
docker compose -f compose.production.yml config -q
docker compose -f compose.production.yml up -d
```

TLS/reverse proxy, gerçek secrets, yedek/PITR, merkezi gözlemleme, lisanslı veri sağlayıcıları ve veri saklama politikaları deploy ortamının sorumluluğundadır. Tam kontrol listesi uygulama durumu belgesindedir.

## Hazır home-server kurulumu

Tailscale adresi `100.104.207.55` için kapalı ağ kurulumu hazırdır. PostgreSQL, Redis ve MinIO host portuna açılmaz; yalnızca web arayüzü Tailscale IP’sinin `8080` portuna bind edilir. Ortam secret’ları git tarafından izlenmeyen `.env.homeserver` dosyasındadır. Home-server MinIO kurulumu KMS gerektirmeyen açık opt-in modundadır; kanıtların disk üzerinde şifrelenmesi için sunucu diski/volume katmanı şifreli olmalıdır.

Home server üzerinde repository dizininde tek komut yeterlidir:

```bash
./scripts/homeserver-up.sh
```

Betik `.env.homeserver` yoksa güçlü rastgele secret’larla otomatik oluşturur; imajları build eder, PostgreSQL runtime rolünü kurar, migration’ları uygular, private evidence bucket’ını ve ilk owner hesabını oluşturur, health check başarılı olana kadar bekler. `8080` başka bir servis tarafından kullanılıyorsa `8081–8099` aralığından boş port otomatik seçilir ve sonuç ekrana yazılır. Varsayılan arayüz:

```text
http://100.104.207.55:8080
```

Yönetim komutları:

```bash
./scripts/homeserver-logs.sh
./scripts/homeserver-backup.sh
./scripts/homeserver-down.sh
```

İlk giriş e-postası `admin@evidera.home`, parola `.env.homeserver` içindeki `BOOTSTRAP_ADMIN_PASSWORD` değeridir. İlk girişten sonra bu değeri değiştirip container’ları yeniden oluşturmak önerilir. HTTP yapılandırması yalnızca şifrelenmiş Tailscale ağı içindir; public internet erişimi verilecekse TLS eklenmeli, `PUBLIC_APP_URL` HTTPS yapılmalı ve `COOKIE_SECURE=true` kullanılmalıdır.

## Güven sınırı

- Yalnızca HTTP/HTTPS hedefleri kabul edilir.
- Localhost, private/link-local/reserved adresler, metadata hostları, URL kimlik bilgileri ve izin verilmeyen portlar reddedilir.
- DNS sonucu doğrulanır, bağlantı doğrulanan IP’ye sabitlenir ve her redirect yeniden kontrol edilir.
- Response byte, süre, sayfa, render ve crawl-delay limitleri uygulanır.
- Browser render aynı-origin kaynaklarla sınırlandırılır; üçüncü taraf çağrıları engellenir.
- Güvenlik denetimleri pasiftir; exploit, brute-force, oturum açma veya aktif zafiyet denemesi yapılmaz.

## Veri doğruluğu

Platform dış gözlemi GSC, Analytics veya reklam hesabı gerçeği gibi göstermez. Visibility ancak gerçek SERP observation varsa hesaplanır. Lab performans metriği Lighthouse/CrUX yerine geçmez; reklam çıktıları hesap içi performans iddiası değil, kanıta bağlı brieflerdir.
