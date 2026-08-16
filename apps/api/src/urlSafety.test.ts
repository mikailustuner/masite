import { describe, expect, it } from "vitest";
import { isBlockedIpAddress, normalizePublicUrl } from "./urlSafety.js";

describe("URL safety", () => {
  it.each(["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.10.2", "169.254.169.254", "::1", "fc00::1", "fe80::1"])("blocks private or reserved address %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it.each(["1.1.1.1", "8.8.8.8", "2606:4700:4700::1111"])("allows public address %s", (address) => {
    expect(isBlockedIpAddress(address)).toBe(false);
  });

  it("normalizes a domain to HTTPS", () => {
    expect(normalizePublicUrl("example.com/path#fragment").toString()).toBe("https://example.com/path");
  });

  it.each(["http://localhost", "http://127.0.0.1", "file:///etc/passwd", "https://user:pass@example.com"])("rejects unsafe URL %s", (url) => {
    expect(() => normalizePublicUrl(url)).toThrow();
  });
});
