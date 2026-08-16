import { describe, expect, it } from "vitest";
import { hashPassword, hashToken, verifyPassword } from "./index.js";

describe("credential primitives", () => {
  it("round-trips a password without storing it", async () => {
    const encoded = await hashPassword("A-production-grade-test-password!");
    expect(encoded).not.toContain("A-production-grade-test-password!");
    await expect(verifyPassword("A-production-grade-test-password!", encoded)).resolves.toBe(true);
    await expect(verifyPassword("A-wrong-production-grade-password!", encoded)).resolves.toBe(false);
  });

  it("binds opaque-token hashes to the application secret", () => {
    expect(hashToken("token", "secret-a-secret-a-secret-a-secret-a")).not.toBe(hashToken("token", "secret-b-secret-b-secret-b-secret-b"));
  });
});
