import { createHash } from "node:crypto";
import type { ExtractedPage } from "@evidera/crawler";
import type { InferInsertModel } from "drizzle-orm";
import type { intelligenceItems, siteEvents } from "@evidera/database";

export type IntelligenceCandidate = Omit<InferInsertModel<typeof intelligenceItems>, "organizationId" | "siteId" | "auditRunId">;
type EventInsert = Omit<InferInsertModel<typeof siteEvents>, "organizationId" | "siteId" | "auditRunId" | "pageId">;

export function buildPageEvents(input: {
  url: string;
  statusCode: number;
  extracted: ExtractedPage | null;
  previous: { statusCode: number; extracted: Record<string, unknown> } | null;
}): EventInsert[] {
  if (!input.previous) return [{
    kind: "page_discovered", severity: "info", title: "Yeni sayfa gözlendi",
    observation: `${input.url} ilk kez bu çalışma alanında ölçüldü.`,
    inference: "Sayfanın gerçekte yeni yayınlandığı değil, Evidera tarafından ilk kez gözlendiği kanıtlanmıştır.",
    impact: "Yeni sayfa sonraki denetimler için değişiklik taban çizgisine eklendi.", sourceUrl: input.url,
    beforeValue: null, afterValue: { statusCode: input.statusCode, title: input.extracted?.title ?? null },
    evidenceData: { source: "crawler", analyzerVersion: "change/0.1.0" },
  }];
  const events: EventInsert[] = [];
  if (input.previous.statusCode !== input.statusCode) events.push(event("status_changed", input.url, "HTTP durumu değişti", input.previous.statusCode, input.statusCode, input.statusCode >= 400 ? "high" : "medium"));
  const fields: Array<{ key: keyof ExtractedPage; label: string; severity?: "info" | "low" | "medium" | "high" }> = [
    { key: "title", label: "Sayfa başlığı", severity: "medium" }, { key: "description", label: "Meta açıklama", severity: "low" },
    { key: "canonicalUrls", label: "Canonical", severity: "high" }, { key: "robotsDirectives", label: "Robots direktifleri", severity: "high" },
    { key: "h1", label: "H1 yapısı", severity: "medium" }, { key: "structuredDataTypes", label: "Structured data türleri", severity: "medium" },
    { key: "ctaTexts", label: "CTA metinleri", severity: "low" }, { key: "thirdPartyOrigins", label: "Üçüncü taraf originleri", severity: "medium" },
  ];
  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(input.previous.extracted, field.key)) continue;
    const before = input.previous.extracted[field.key as string];
    const after = input.extracted?.[field.key] ?? null;
    if (stable(before) !== stable(after)) events.push(event(`${String(field.key)}_changed`, input.url, `${field.label} değişti`, before, after, field.severity ?? "low"));
  }
  return events;
}

export function buildPageIntelligence(input: { url: string; extracted: ExtractedPage; responseBytes: number; responseTimeMs: number }): IntelligenceCandidate[] {
  const { extracted, url } = input;
  const output: IntelligenceCandidate[] = [];
  const add = (module: string, rule: string, item: Omit<IntelligenceCandidate, "module" | "fingerprint" | "status" | "firstSeenAt" | "lastSeenAt" | "createdAt" | "updatedAt">) => output.push({
    module, fingerprint: createHash("sha256").update(`${module}:${rule}:${new URL(url).pathname}`).digest("hex"), status: "active", ...item,
  });
  if (extracted.textWordCount < 150) add("content", "low-visible-copy", {
    priority: 64, confidence: "strong_inference", title: "Görünür içerik kapsamı sınırlı",
    observation: `${url} üzerinde script/style hariç yaklaşık ${extracted.textWordCount} kelime gözlendi.`, evidenceSummary: `textWordCount=${extracted.textWordCount}`,
    inference: "Sayfanın amacına göre bu miktar yeterli olabilir; arama performansı veya kalite sonucu çıkarılamaz.", impact: "Kullanıcı sorularının ve arama amacının eksik karşılanması riski vardır.",
    recommendation: "Sayfanın amacı ve hedef sorguları için eksik konu, kanıt, karşılaştırma ve karar bilgilerini manuel olarak değerlendirin.", verification: "İçerik brief’ini SERP örnekleriyle doğrulayın ve yayın sonrası rank observation değişimini izleyin.",
    source: "rendered_html", methodology: "Görünür gövde metninin deterministik kelime sayımı.", measurement: { url, textWordCount: extracted.textWordCount },
  });
  if (extracted.structuredDataTypes.length === 0) add("structured_data", "schema-opportunity", {
    priority: 45, confidence: "hypothesis", title: "Structured data fırsatı değerlendirilebilir", observation: `${url} üzerinde ayrıştırılabilir schema türü gözlenmedi.`, evidenceSummary: "structuredDataTypes=[]",
    inference: "Sayfanın rich-result için uygun bir içerik türüne sahip olduğu otomatik olarak bilinemez.", impact: "Uygun bir sayfa türüyse arama motorlarına açık entity ipuçları sağlanmıyor olabilir.",
    recommendation: "Sayfa türünü belirleyin ve yalnızca görünür içerikle uyumlu, resmî olarak desteklenen schema türlerini değerlendirin.", verification: "Schema validator ve ilgili arama motorunun rich-result testiyle doğrulayın.",
    source: "html_jsonld", methodology: "JSON-LD bloklarından @type çıkarımı.", measurement: { url, types: [] },
  });
  if (extracted.formFieldCount > 0 && extracted.unlabeledFormFieldCount > 0) add("accessibility", "unlabelled-form-fields", {
    priority: 82, confidence: "proven", title: "Form alanlarının bazılarında programatik etiket gözlenmedi", observation: `${extracted.formFieldCount} alanın ${extracted.unlabeledFormFieldCount} tanesinde label veya accessible-name bağı gözlenmedi.`, evidenceSummary: `fields=${extracted.formFieldCount}; unlabeled=${extracted.unlabeledFormFieldCount}`,
    inference: "DOM tabanlı kontrol kanıtlandı; yardımcı teknolojiyle uçtan uca form deneyimi ayrıca test edilmelidir.", impact: "Ekran okuyucu ve sesli kontrol kullanıcıları alanın amacını anlayamayabilir.", recommendation: "Her alanı görünür label ile programatik olarak ilişkilendirin.", verification: "axe, accessibility tree ve klavye/ekran okuyucu yolculuğuyla yeniden test edin.",
    source: "html_dom", methodology: "Form alanlarında label, aria-label, aria-labelledby ve kapsayıcı label kontrolü.", measurement: { url, formFieldCount: extracted.formFieldCount, unlabeledFormFieldCount: extracted.unlabeledFormFieldCount },
  });
  if (extracted.thirdPartyOrigins.length > 0) add("privacy", "third-party-inventory", {
    priority: extracted.cookieBannerDetected ? 42 : 70, confidence: "proven", title: "Üçüncü taraf script originleri gözlendi", observation: `${extracted.thirdPartyOrigins.length} farklı üçüncü taraf script origin’i bulundu.`, evidenceSummary: extracted.thirdPartyOrigins.join(", "),
    inference: "Script varlığı veri işlendiğini, consent’in geçerli olduğunu veya hukuki ihlali tek başına kanıtlamaz.", impact: "Privacy, güvenlik, performans ve tedarik zinciri incelemesi gerektirebilir.", recommendation: "Originleri amaç, sağlayıcı, consent kategorisi ve veri saklama politikasıyla eşleştirin.", verification: "Consent öncesi/sonrası network farkını ayrı sentetik senaryoyla ölçün.",
    source: "html_script_inventory", methodology: "Sayfa origininden farklı script src originlerinin envanteri.", measurement: { url, origins: extracted.thirdPartyOrigins, cookieBannerDetected: extracted.cookieBannerDetected },
  });
  if (extracted.deprecatedElementCount > 0) add("compatibility", "deprecated-elements", {
    priority: 58, confidence: "proven", title: "Eski HTML elementleri kullanılıyor", observation: `${extracted.deprecatedElementCount} deprecated HTML elementi gözlendi.`, evidenceSummary: `deprecatedElementCount=${extracted.deprecatedElementCount}`,
    inference: "Bu sayı tek başına kullanıcıda hata oluştuğunu göstermez.", impact: "Tarayıcı uyumluluğu, erişilebilirlik ve bakım maliyeti etkilenebilir.", recommendation: "Eski elementleri semantik HTML ve CSS karşılıklarıyla değiştirin.", verification: "HTML validator ve hedef tarayıcı matrisiyle yeniden doğrulayın.",
    source: "html_dom", methodology: "Standart dışı/eski element listesinin deterministik sayımı.", measurement: { url, deprecatedElementCount: extracted.deprecatedElementCount },
  });
  if (input.responseBytes > 1_000_000 || extracted.scriptSources.length > 15 || extracted.imageCount > 30) add("sustainability", "resource-weight", {
    priority: 55, confidence: "proven", title: "Kaynak ağırlığı optimizasyon adayı", observation: `${input.responseBytes} HTML byte, ${extracted.scriptSources.length} harici script ve ${extracted.imageCount} görsel gözlendi.`, evidenceSummary: `htmlBytes=${input.responseBytes}; scripts=${extracted.scriptSources.length}; images=${extracted.imageCount}`,
    inference: "Karbon emisyonu veya gerçek transfer toplamı bu HTML ölçümünden hesaplanamaz.", impact: "Fazla kaynak performans, cihaz enerjisi ve veri kullanımını artırabilir.", recommendation: "Network waterfall ile kullanılmayan JS/CSS, görsel boyutu, lazy-loading ve cache fırsatlarını inceleyin.", verification: "Aynı cihaz/ağ profiliyle transfer byte ve Web Vitals ölçümünü tekrarlayın.",
    source: "crawler_html", methodology: "HTML byte ve DOM kaynak işaretlerinin eşik tabanlı taraması.", measurement: { url, htmlBytes: input.responseBytes, scripts: extracted.scriptSources.length, images: extracted.imageCount },
  });
  if (extracted.formCount > 0) add("ads", "landing-form-readiness", {
    priority: 50, confidence: "strong_inference", title: "Landing page form yolculuğu test edilebilir", observation: `${url} üzerinde ${extracted.formCount} form ve ${extracted.formFieldCount} kullanıcı alanı gözlendi.`, evidenceSummary: `forms=${extracted.formCount}; fields=${extracted.formFieldCount}`,
    inference: "Formun gönderildiği, lead kalitesi veya dönüşüm oranı harici gözlemle bilinemez.", impact: "Reklam–landing page uyumu ve form sürtünmesi sentetik yolculukla değerlendirilebilir.", recommendation: "Gönderim yapmayan mobil sentetik form senaryosu tanımlayın.", verification: "CTA’dan son onay adımına kadar ekran görüntülü yolculuğu çalıştırın.",
    source: "html_dom", methodology: "Form ve kullanıcı alanı envanteri.", measurement: { url, forms: extracted.formCount, fields: extracted.formFieldCount, ctas: extracted.ctaTexts.slice(0, 10) },
  });
  if (new URL(url).pathname === "/" && extracted.contactLinkCount === 0) add("trust", "contact-discoverability", {
    priority: 40, confidence: "hypothesis", title: "Doğrudan iletişim bağlantısı gözlenmedi", observation: "Ana sayfada tel:, mailto: veya yaygın WhatsApp bağlantısı bulunmadı.", evidenceSummary: "contactLinkCount=0",
    inference: "İletişim sayfası veya JavaScript tabanlı iletişim seçenekleri başka yerde bulunabilir.", impact: "Güven ve hızlı iletişim yolculuğu bazı kullanıcılar için zorlaşabilir.", recommendation: "İş modeline uygunsa ana navigasyon veya footer’da açık iletişim yolu sağlayın.", verification: "Mobil ve desktop kullanıcı yolculuğunda iletişime ulaşma adım sayısını ölçün.",
    source: "html_links", methodology: "Ana sayfadaki doğrudan iletişim URI’larının kontrolü.", measurement: { url, contactLinkCount: 0 },
  });
  return output;
}

function event(kind: string, url: string, label: string, before: unknown, after: unknown, severity: "info" | "low" | "medium" | "high"): EventInsert {
  return { kind, severity, title: label, observation: `${url} üzerinde ${label.toLocaleLowerCase("tr")} gözlendi.`, inference: "Değişikliğin amacı ve trafik, sıralama veya dönüşüm üzerindeki nedensel etkisi dış gözlemle bilinemez.", impact: "Değişiklik teknik, içerik veya kullanıcı deneyimi incelemesi gerektirebilir.", sourceUrl: url, beforeValue: before ?? null, afterValue: after ?? null, evidenceData: { source: "snapshot_diff", analyzerVersion: "change/0.1.0" } };
}

function stable(value: unknown): string { return JSON.stringify(value ?? null, Object.keys((value && typeof value === "object" && !Array.isArray(value) ? value : {}) as Record<string, unknown>).sort()); }
