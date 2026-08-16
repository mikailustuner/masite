import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import tls from "node:tls";
import { normalizePublicUrl, resolvePublicTarget, safeFetch } from "@evidera/crawler";
import type { WorkerEnvironment } from "@evidera/runtime";
import type { IntelligenceCandidate } from "../intelligenceEngine.js";

export async function collectExternalIntelligence(origin: string, environment: WorkerEnvironment): Promise<IntelligenceCandidate[]> {
  const url = normalizePublicUrl(origin, environment.CRAWLER_ALLOWED_PORTS);
  const results = await Promise.allSettled([collectDns(url.hostname), collectTls(url, environment), collectSecurityTxt(url, environment), collectCrux(url.origin, environment.CRUX_API_KEY)]);
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

async function collectDns(hostname: string): Promise<IntelligenceCandidate[]> {
  const resolver = new Resolver(); resolver.setServers(["1.1.1.1", "8.8.8.8"]);
  const [mxResult, spfResult, dmarcResult, caaResult] = await Promise.allSettled([resolver.resolveMx(hostname), resolver.resolveTxt(hostname), resolver.resolveTxt(`_dmarc.${hostname}`), resolver.resolveCaa(hostname)]);
  const mx = mxResult.status === "fulfilled" ? mxResult.value : [];
  const txt = spfResult.status === "fulfilled" ? spfResult.value.map((item) => item.join("")) : [];
  const dmarc = dmarcResult.status === "fulfilled" ? dmarcResult.value.map((item) => item.join("")) : [];
  const caa = caaResult.status === "fulfilled" ? caaResult.value : [];
  const output: IntelligenceCandidate[] = [];
  if (mx.length > 0 && !txt.some((value) => value.toLowerCase().startsWith("v=spf1"))) output.push(candidate(hostname, "trust", "spf-missing", 62, "proven", "E-posta domaininde SPF kaydı gözlenmedi", `MX kaydı bulunan ${hostname} için public TXT yanıtlarında SPF başlangıcı bulunmadı.`, JSON.stringify({ mx, txt }), "Public DNS yanıtı gözlenmiştir; gönderim altyapısı ve teslimat sonucu bilinemez.", "Domain adına yetkisiz e-posta gönderimi riskinin azaltılması için politika incelemesi gerekir.", "E-posta sağlayıcısının önerdiği tek ve geçerli SPF politikasını oluşturun.", "Public DNS üzerinden SPF syntax ve lookup limitini yeniden doğrulayın.", "dns_txt", "Public DNS MX/TXT sorgusu.", { hostname, mx, spf: [] }));
  if (mx.length > 0 && !dmarc.some((value) => value.toLowerCase().startsWith("v=dmarc1"))) output.push(candidate(hostname, "trust", "dmarc-missing", 68, "proven", "DMARC politikası gözlenmedi", `${hostname} için MX bulundu ancak _dmarc TXT yanıtında DMARC kaydı gözlenmedi.`, JSON.stringify({ mx, dmarc }), "Public DNS durumu kanıtlandı; domainin aktif e-posta gönderip göndermediği bilinemez.", "Spoofing görünürlüğü ve raporlama kapasitesi sınırlı olabilir.", "Önce p=none ve raporlama ile kontrollü DMARC geçiş planı hazırlayın; sağlayıcı doğrulaması olmadan reject uygulamayın.", "DMARC analyzer ve gerçek gönderim kaynaklarıyla politikayı doğrulayın.", "dns_txt", "Public DNS MX ve _dmarc TXT sorgusu.", { hostname, mx, dmarc: [] }));
  if (caa.length === 0) output.push(candidate(hostname, "trust", "caa-absent", 28, "proven", "CAA kaydı gözlenmedi", `${hostname} public DNS yanıtında CAA kaydı döndürmedi.`, "caa=[]", "CAA kaydı zorunlu değildir ve yokluğu sertifikanın güvensiz olduğunu kanıtlamaz.", "Sertifika otoritesi yetkilendirmesi domain seviyesinde sınırlandırılmıyor olabilir.", "Kurumun sertifika sağlayıcısı ve rotasyon süreci uygunsa CAA politikası değerlendirin.", "Yetkili CA ve disaster-recovery sertifika akışıyla birlikte doğrulayın.", "dns_caa", "Public DNS CAA sorgusu.", { hostname, caa: [] }));
  return output;
}

async function collectTls(url: URL, environment: WorkerEnvironment): Promise<IntelligenceCandidate[]> {
  if (url.protocol !== "https:") return [candidate(url.hostname, "trust", "https-absent", 90, "proven", "Site HTTPS kullanmıyor", `${url.origin} başlangıç adresi HTTP protokolünü kullanıyor.`, url.toString(), "Başlangıç URL protokolü kanıtlandı; başka HTTPS varyantlarının varlığı ayrıca kontrol edilmelidir.", "Aktarım gizliliği ve kullanıcı güveni etkilenebilir.", "Geçerli TLS sertifikasıyla HTTPS yayınlayın ve kontrollü redirect uygulayın.", "HTTP ve HTTPS varyantlarını dış istemciden yeniden doğrulayın.", "url_protocol", "Normalize edilmiş başlangıç URL protokolü.", { origin: url.origin })];
  const target = await resolvePublicTarget(url);
  const certificate = await new Promise<tls.PeerCertificate>((resolve, reject) => {
    const socket = tls.connect({ host: target.address, port: Number(url.port || 443), servername: url.hostname, rejectUnauthorized: true, timeout: environment.CRAWLER_TIMEOUT_MS }, () => { const cert = socket.getPeerCertificate(); socket.end(); resolve(cert); });
    socket.once("timeout", () => { socket.destroy(); reject(new Error("TLS timeout")); }); socket.once("error", reject);
  });
  const expiresAt = new Date(certificate.valid_to); const daysRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 86_400_000);
  if (daysRemaining > 30) return [];
  return [candidate(url.hostname, "trust", "tls-expiry", daysRemaining <= 7 ? 95 : 78, "proven", "TLS sertifikası yakında sona eriyor", `Sertifika ${expiresAt.toISOString()} tarihinde sona eriyor; yaklaşık ${daysRemaining} gün kaldı.`, JSON.stringify({ validTo: certificate.valid_to, issuer: certificate.issuer, fingerprint256: certificate.fingerprint256 }), "Sertifikanın bu ölçüm anındaki public endpoint durumu kanıtlandı; otomatik yenileme sistemi bilinemez.", "Yenileme başarısız olursa ziyaretçiler bağlantı hatası yaşayabilir.", "Otomatik sertifika yenilemeyi ve süresi dolmadan alarmı doğrulayın.", "Yeni sertifika zinciri yayınlandıktan sonra dış TLS handshake’i tekrarlayın.", "tls_handshake", "SSRF doğrulamalı IP’ye SNI ile pasif TLS handshake.", { hostname: url.hostname, expiresAt: expiresAt.toISOString(), daysRemaining, issuer: certificate.issuer })];
}

async function collectSecurityTxt(url: URL, environment: WorkerEnvironment): Promise<IntelligenceCandidate[]> {
  const securityUrl = new URL("/.well-known/security.txt", url.origin).toString();
  try {
    const response = await safeFetch(securityUrl, { userAgent: environment.CRAWLER_USER_AGENT, timeoutMs: environment.CRAWLER_TIMEOUT_MS, maxResponseBytes: 256_000, allowedPorts: environment.CRAWLER_ALLOWED_PORTS });
    if (response.statusCode === 200) return [];
    return [candidate(url.hostname, "trust", "security-txt-missing", 32, "proven", "security.txt well-known adresinde yayınlanmıyor", `${securityUrl} isteği HTTP ${response.statusCode} döndürdü.`, `status=${response.statusCode}`, "security.txt her site için zorunlu değildir.", "Güvenlik araştırmacılarının doğru bildirim kanalını bulması zorlaşabilir.", "Kurumsal süreç uygunsa RFC 9116 biçiminde iletişim ve expiry alanlı security.txt yayınlayın.", "Well-known URL’yi yeniden isteyip içerik ve expiry alanlarını doğrulayın.", "http_security_txt", "SSRF korumalı pasif GET isteği.", { url: securityUrl, statusCode: response.statusCode })];
  } catch (error) { return [candidate(url.hostname, "trust", "security-txt-unreachable", 25, "strong_inference", "security.txt doğrulanamadı", `${securityUrl} isteği tamamlanamadı.`, error instanceof Error ? error.message : "Fetch failed", "Tek istek hatası dosyanın genel olarak erişilemez olduğunu kanıtlamaz.", "Güvenlik bildirim kanalı doğrulanamadı.", "Well-known security.txt yayınını ve WAF davranışını kontrol edin.", "Aynı dış ölçüm noktasından yeniden test edin.", "http_security_txt", "SSRF korumalı pasif GET isteği.", { url: securityUrl })]; }
}

async function collectCrux(origin: string, apiKey?: string): Promise<IntelligenceCandidate[]> {
  if (!apiKey) return [];
  const response = await fetch(`https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=${encodeURIComponent(apiKey)}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ origin, formFactor: "PHONE", metrics: ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"] }), signal: AbortSignal.timeout(15_000) });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error(`CrUX request failed with HTTP ${response.status}`);
  const payload = await response.json() as { record?: { metrics?: Record<string, { percentiles?: { p75?: number | string } }>; collectionPeriod?: unknown } };
  const metrics = payload.record?.metrics ?? {}; const lcp = Number(metrics.largest_contentful_paint?.percentiles?.p75); const inp = Number(metrics.interaction_to_next_paint?.percentiles?.p75); const cls = Number(metrics.cumulative_layout_shift?.percentiles?.p75);
  const poor = lcp > 2500 || inp > 200 || cls > 0.1;
  if (!poor) return [];
  return [candidate(new URL(origin).hostname, "performance", "crux-field-vitals", 88, "proven", "CrUX mobil field eşikleri karşılanmıyor", `Origin p75 değerleri LCP=${lcp}ms, INP=${inp}ms, CLS=${cls}.`, JSON.stringify({ lcpP75: lcp, inpP75: inp, clsP75: cls, collectionPeriod: payload.record?.collectionPeriod }), "CrUX uygun Chrome kullanıcılarından toplulaştırılmış field verisidir; tüm kullanıcıları veya tek URL’yi temsil etmeyebilir.", "Gerçek kullanıcı deneyiminin en az bir Core Web Vital boyutunda önerilen eşiği aşma riski vardır.", "CrUX trendini lab trace ve template örnekleriyle eşleştirerek LCP/INP/CLS kök nedenini giderin.", "Sonraki 28 günlük CrUX döneminde p75 değerlerini ve aynı cihaz profili lab ölçümünü izleyin.", "crux_api", "CrUX API PHONE origin record; p75 eşik karşılaştırması.", { origin, formFactor: "PHONE", lcpP75: lcp, inpP75: inp, clsP75: cls, collectionPeriod: payload.record?.collectionPeriod })];
}

function candidate(hostname: string, module: string, rule: string, priority: number, confidence: "proven" | "strong_inference" | "hypothesis", title: string, observation: string, evidenceSummary: string, inference: string, impact: string, recommendation: string, verification: string, source: string, methodology: string, measurement: Record<string, unknown>): IntelligenceCandidate {
  return { module, fingerprint: createHash("sha256").update(`${module}:${rule}:${hostname}`).digest("hex"), status: "active", priority, confidence, title, observation, evidenceSummary, inference, impact, recommendation, verification, source, methodology, measurement };
}
