import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const blockedHostnames = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

function ipv4ToInteger(address: string): number {
  return address.split(".").reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInteger(address) & mask) === (ipv4ToInteger(base) & mask);
}

export function isBlockedIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return [
      ["0.0.0.0", 8],
      ["10.0.0.0", 8],
      ["100.64.0.0", 10],
      ["127.0.0.0", 8],
      ["169.254.0.0", 16],
      ["172.16.0.0", 12],
      ["192.0.0.0", 24],
      ["192.0.2.0", 24],
      ["192.168.0.0", 16],
      ["198.18.0.0", 15],
      ["198.51.100.0", 24],
      ["203.0.113.0", 24],
      ["224.0.0.0", 4],
      ["240.0.0.0", 4],
    ].some(([base, prefix]) => inIpv4Range(address, String(base), Number(prefix)));
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(normalized)) return true;
    if (normalized.startsWith("ff")) return true;
    if (normalized.startsWith("2001:db8")) return true;
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      return isIP(mapped) === 4 ? isBlockedIpAddress(mapped) : true;
    }
    return false;
  }

  return true;
}

export function normalizePublicUrl(input: string): URL {
  const candidate = input.trim();
  const explicitScheme = /^([a-z][a-z\d+.-]*):\/\//i.exec(candidate)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") {
    throw new Error("Yalnızca HTTP ve HTTPS adresleri taranabilir.");
  }
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  const url = new URL(withProtocol);

  if (!(["http:", "https:"] as string[]).includes(url.protocol)) {
    throw new Error("Yalnızca HTTP ve HTTPS adresleri taranabilir.");
  }
  if (url.username || url.password) {
    throw new Error("Kimlik bilgisi içeren URL’ler kabul edilmez.");
  }
  if (blockedHostnames.has(url.hostname.toLowerCase()) || url.hostname.endsWith(".localhost")) {
    throw new Error("Yerel ve metadata adresleri taranamaz.");
  }
  if (isIP(url.hostname) && isBlockedIpAddress(url.hostname)) {
    throw new Error("Özel, yerel veya ayrılmış IP adresleri taranamaz.");
  }

  url.hash = "";
  return url;
}

export async function resolvePublicTarget(url: URL): Promise<{ address: string; family: 4 | 6 }> {
  if (isIP(url.hostname)) {
    if (isBlockedIpAddress(url.hostname)) throw new Error("Özel IP adresleri taranamaz.");
    return { address: url.hostname, family: isIP(url.hostname) as 4 | 6 };
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("Domain için DNS sonucu bulunamadı.");
  if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
    throw new Error("Domain özel veya ayrılmış bir IP adresine çözümleniyor.");
  }
  const first = addresses[0];
  if (!first || (first.family !== 4 && first.family !== 6)) throw new Error("Desteklenen bir IP adresi bulunamadı.");
  return { address: first.address, family: first.family };
}
