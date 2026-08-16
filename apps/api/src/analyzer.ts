import type { SafeFetchResult } from "./safeFetch.js";

export interface ExternalObservation {
  id: string;
  category: "http" | "seo" | "accessibility" | "security" | "performance";
  title: string;
  severity: "high" | "medium" | "low" | "info";
  confidence: "proven";
  evidence: string;
  recommendation: string;
}

function firstMatch(html: string, expression: RegExp): string | null {
  return expression.exec(html)?.[1]?.trim() ?? null;
}

function hasHeader(result: SafeFetchResult, name: string): boolean {
  return Boolean(result.headers[name.toLowerCase()]);
}

export function analyzeExternalResponse(result: SafeFetchResult): ExternalObservation[] {
  const observations: ExternalObservation[] = [];
  const html = result.body;
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
    ?? firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const canonical = firstMatch(html, /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i)
    ?? firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i);
  const htmlLanguage = firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i);
  const h1Count = (html.match(/<h1\b[^>]*>/gi) ?? []).length;

  if (result.statusCode >= 400) observations.push({ id: "http-error", category: "http", title: `Sayfa HTTP ${result.statusCode} döndürüyor`, severity: "high", confidence: "proven", evidence: `Final URL ${result.finalUrl} için durum kodu ${result.statusCode}.`, recommendation: "URL’nin beklenen yanıtını ve yönlendirme politikasını kontrol edin." });
  if (!title) observations.push({ id: "missing-title", category: "seo", title: "Sayfa başlığı bulunamadı", severity: "high", confidence: "proven", evidence: "Alınan HTML içinde title öğesi yok.", recommendation: "Sayfanın ana niyetini ve markayı açıklayan benzersiz bir title ekleyin." });
  if (!description) observations.push({ id: "missing-description", category: "seo", title: "Meta description bulunamadı", severity: "medium", confidence: "proven", evidence: "Alınan HTML içinde name=description meta etiketi yok.", recommendation: "Sonuç snippet’i için sayfaya özgü, açıklayıcı bir meta description ekleyin." });
  if (!canonical) observations.push({ id: "missing-canonical", category: "seo", title: "Canonical etiketi bulunamadı", severity: "medium", confidence: "proven", evidence: "Alınan HTML içinde rel=canonical bağlantısı yok.", recommendation: "URL politikanız gerektiriyorsa aynı protokol ve host üzerindeki tercih edilen URL’yi canonical olarak belirtin." });
  if (!htmlLanguage) observations.push({ id: "missing-lang", category: "accessibility", title: "Doküman dili belirtilmemiş", severity: "medium", confidence: "proven", evidence: "HTML kök öğesinde lang niteliği yok.", recommendation: "Sayfanın ana dilini geçerli BCP 47 dil etiketiyle belirtin." });
  if (h1Count === 0) observations.push({ id: "missing-h1", category: "seo", title: "Ana başlık bulunamadı", severity: "medium", confidence: "proven", evidence: "Alınan HTML içinde h1 öğesi yok.", recommendation: "Sayfanın ana konusunu açıklayan görünür bir ana başlık kullanın." });
  if (h1Count > 1) observations.push({ id: "multiple-h1", category: "seo", title: "Birden fazla ana başlık gözlendi", severity: "low", confidence: "proven", evidence: `Alınan HTML içinde ${h1Count} adet h1 öğesi var.`, recommendation: "Başlık hiyerarşisini içerik yapısına göre manuel olarak doğrulayın." });

  const securityHeaders = ["content-security-policy", "strict-transport-security", "x-content-type-options", "referrer-policy", "permissions-policy"];
  const missingSecurityHeaders = securityHeaders.filter((header) => !hasHeader(result, header));
  if (missingSecurityHeaders.length > 0) observations.push({ id: "security-headers", category: "security", title: "Bazı güvenlik header’ları gözlenmedi", severity: "low", confidence: "proven", evidence: `Yanıtta gözlenmeyen header’lar: ${missingSecurityHeaders.join(", ")}.`, recommendation: "Her header’ın uygulama bağlamındaki gerekliliğini değerlendirin; yalnızca varlığı değil politika değerini de doğrulayın." });

  return observations;
}
