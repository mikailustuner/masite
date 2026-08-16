import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const blockedHostnames = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "metadata"]);
const blockedIpv4Ranges: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
];

function ipv4ToInteger(address: string): number {
  return address.split(".").reduce((value, octet) => (value * 256) + Number(octet), 0) >>> 0;
}

function inIpv4Range(address: string, base: string, prefix: number): boolean {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInteger(address) & mask) === (ipv4ToInteger(base) & mask);
}

export function isBlockedIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return blockedIpv4Ranges.some(([base, prefix]) => inIpv4Range(address, base, prefix));
  if (version === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::" || normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd") || /^fe[89ab]/.test(normalized) || normalized.startsWith("ff")) return true;
    if (normalized.startsWith("2001:db8") || normalized.startsWith("64:ff9b:")) return true;
    if (normalized.startsWith("::ffff:")) {
      const mapped = normalized.slice(7);
      return isIP(mapped) === 4 ? isBlockedIpAddress(mapped) : true;
    }
    return false;
  }
  return true;
}

export function normalizePublicUrl(input: string, allowedPorts: readonly number[] = [80, 443]): URL {
  const candidate = input.trim();
  const explicitScheme = /^([a-z][a-z\d+.-]*):\/\//i.exec(candidate)?.[1]?.toLowerCase();
  if (explicitScheme && explicitScheme !== "http" && explicitScheme !== "https") throw new Error("Only HTTP and HTTPS URLs are supported.");
  const url = new URL(/^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
  if (url.username || url.password) throw new Error("Credential-bearing URLs are not accepted.");
  if (blockedHostnames.has(url.hostname.toLowerCase()) || url.hostname.endsWith(".localhost")) throw new Error("Local and metadata hosts are denied.");
  if (isIP(url.hostname)) throw new Error("IP-literal targets are denied.");
  const effectivePort = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!allowedPorts.includes(effectivePort)) throw new Error("The destination port is not permitted.");
  url.hash = "";
  return url;
}

export async function resolvePublicTarget(url: URL): Promise<{ address: string; family: 4 | 6 }> {
  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0) throw new Error("No DNS result was found for the domain.");
  if (addresses.some((entry) => isBlockedIpAddress(entry.address))) throw new Error("The domain resolves to a private or reserved address.");
  const first = addresses[0];
  if (!first || (first.family !== 4 && first.family !== 6)) throw new Error("No supported IP address was found.");
  return { address: first.address, family: first.family };
}

const trackingParameters = new Set(["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid"]);

export function normalizeCrawlUrl(input: string | URL): URL {
  const url = new URL(input);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith("utm_") || trackingParameters.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/" && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  return url;
}
