import { beforeEach, describe, expect, it } from "vitest";
import { _resetKeyCache, decryptSecret, encryptSecret } from "./secrets";

beforeEach(() => {
  process.env.ENCRYPTION_KEY = "test-encryption-key-at-least-16-chars";
  _resetKeyCache();
});

describe("secret encryption", () => {
  it("round-trips a value", () => {
    const encrypted = encryptSecret("sk-ant-secret");
    expect(encrypted).not.toContain("sk-ant-secret");
    expect(decryptSecret(encrypted)).toBe("sk-ant-secret");
  });

  it("produces different ciphertext each time (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("fails to decrypt with a different key", () => {
    const encrypted = encryptSecret("secret");
    process.env.ENCRYPTION_KEY = "a-different-key-also-16-plus-chars";
    _resetKeyCache();
    expect(() => decryptSecret(encrypted)).toThrow();
  });

  it("rejects a tampered ciphertext", () => {
    const encrypted = encryptSecret("secret");
    const tampered = encrypted.slice(0, -2) + "xy";
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("throws when the key is missing or too short", () => {
    process.env.ENCRYPTION_KEY = "short";
    _resetKeyCache();
    expect(() => encryptSecret("x")).toThrow(/ENCRYPTION_KEY/);
  });
});
