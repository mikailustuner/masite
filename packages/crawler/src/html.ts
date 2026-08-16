import { load } from "cheerio";

export interface ExtractedPage {
  title: string | null;
  description: string | null;
  canonicalUrls: string[];
  language: string | null;
  robotsDirectives: string[];
  h1: string[];
  headings: Array<{ level: number; text: string }>;
  links: string[];
  structuredDataBlocks: number;
  invalidStructuredDataBlocks: number;
  imageCount: number;
  imagesMissingAlt: number;
  viewport: string | null;
  openGraphTitle: string | null;
  openGraphDescription: string | null;
  hreflangValues: string[];
  textWordCount: number;
  formCount: number;
  formFieldCount: number;
  unlabeledFormFieldCount: number;
  ctaTexts: string[];
  scriptSources: string[];
  thirdPartyOrigins: string[];
  structuredDataTypes: string[];
  deprecatedElementCount: number;
  cookieBannerDetected: boolean;
  contactLinkCount: number;
}

export function extractHtml(html: string, pageUrl: string): ExtractedPage {
  const $ = load(html);
  const links = new Set<string>();
  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    if (!href) return;
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol === "http:" || url.protocol === "https:") links.add(url.toString());
    } catch { /* Invalid author-supplied URL is ignored and may be reported by a dedicated rule later. */ }
  });
  const headings: ExtractedPage["headings"] = [];
  $("h1,h2,h3,h4,h5,h6").each((_index, element) => {
    const tagName = element.tagName.toLowerCase();
    headings.push({ level: Number(tagName.slice(1)), text: $(element).text().replace(/\s+/g, " ").trim() });
  });
  const canonicalUrls = $("link[rel~='canonical'][href]").map((_index, element) => $(element).attr("href") ?? "").get().filter(Boolean);
  const robots = $("meta[name='robots'],meta[name='googlebot']").map((_index, element) => $(element).attr("content") ?? "").get().flatMap((value) => value.toLowerCase().split(",").map((entry) => entry.trim())).filter(Boolean);
  const structuredData = $("script[type='application/ld+json']").map((_index, element) => $(element).text()).get();
  const invalidStructuredDataBlocks = structuredData.filter((value) => { try { JSON.parse(value); return false; } catch { return true; } }).length;
  const structuredDataTypes = new Set<string>();
  for (const value of structuredData) {
    try {
      const parsed: unknown = JSON.parse(value);
      collectSchemaTypes(parsed, structuredDataTypes);
    } catch { /* Invalid blocks are counted separately. */ }
  }
  const images = $("img");
  const fields = $("input:not([type='hidden']),select,textarea");
  const unlabeledFormFieldCount = fields.filter((_index, element) => {
    const id = $(element).attr("id");
    return !$(element).attr("aria-label") && !$(element).attr("aria-labelledby") && !$(element).closest("label").length && !(id && $(`label[for='${escapeSelectorValue(id)}']`).length);
  }).length;
  const scriptSources = $("script[src]").map((_index, element) => $(element).attr("src") ?? "").get().filter(Boolean).map((source) => { try { return new URL(source, pageUrl).toString(); } catch { return source; } });
  const pageOrigin = new URL(pageUrl).origin;
  const thirdPartyOrigins = [...new Set(scriptSources.flatMap((source) => { try { const origin = new URL(source).origin; return origin === pageOrigin ? [] : [origin]; } catch { return []; } }))];
  const visibleText = $("body").clone().find("script,style,noscript,svg").remove().end().text().replace(/\s+/g, " ").trim();
  const ctaTexts = $("a,button,input[type='submit']").map((_index, element) => ($(element).attr("value") ?? $(element).text()).replace(/\s+/g, " ").trim()).get().filter((value) => value.length >= 2 && value.length <= 100).slice(0, 30);
  const bodyTextLower = visibleText.toLocaleLowerCase("tr");
  return {
    title: $("title").first().text().replace(/\s+/g, " ").trim() || null,
    description: $("meta[name='description']").first().attr("content")?.trim() || null,
    canonicalUrls,
    language: $("html").attr("lang")?.trim() || null,
    robotsDirectives: [...new Set(robots)],
    h1: headings.filter((heading) => heading.level === 1).map((heading) => heading.text),
    headings,
    links: [...links],
    structuredDataBlocks: structuredData.length,
    invalidStructuredDataBlocks,
    imageCount: images.length,
    imagesMissingAlt: images.filter((_index, element) => $(element).attr("alt") === undefined).length,
    viewport: $("meta[name='viewport']").first().attr("content")?.trim() || null,
    openGraphTitle: $("meta[property='og:title']").first().attr("content")?.trim() || null,
    openGraphDescription: $("meta[property='og:description']").first().attr("content")?.trim() || null,
    hreflangValues: $("link[rel~='alternate'][hreflang]").map((_index, element) => $(element).attr("hreflang") ?? "").get().filter(Boolean),
    textWordCount: visibleText ? visibleText.split(/\s+/).length : 0,
    formCount: $("form").length,
    formFieldCount: fields.length,
    unlabeledFormFieldCount,
    ctaTexts,
    scriptSources,
    thirdPartyOrigins,
    structuredDataTypes: [...structuredDataTypes],
    deprecatedElementCount: $("acronym,applet,basefont,bgsound,big,blink,center,dir,font,frame,frameset,marquee,nobr,noembed,noframes,plaintext,strike,tt").length,
    cookieBannerDetected: ["çerez", "cookie", "consent", "privacy preferences", "gizlilik tercihleri"].some((term) => bodyTextLower.includes(term)),
    contactLinkCount: $("a[href^='tel:'],a[href^='mailto:'],a[href*='wa.me'],a[href*='whatsapp']").length,
  };
}

function collectSchemaTypes(value: unknown, output: Set<string>): void {
  if (Array.isArray(value)) { for (const item of value) collectSchemaTypes(item, output); return; }
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const type = record["@type"];
  if (typeof type === "string") output.add(type);
  if (Array.isArray(type)) for (const item of type) if (typeof item === "string") output.add(item);
  for (const child of Object.values(record)) if (child && typeof child === "object") collectSchemaTypes(child, output);
}

function escapeSelectorValue(value: string): string { return value.replaceAll("'", "\\'"); }
