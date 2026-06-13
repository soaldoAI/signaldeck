import { describe, expect, it } from "vitest";
import { setupSchema } from "./validation";

const base = {
  email: "admin@example.com",
  password: "a-good-password",
  aiProvider: "ollama",
  smtpHost: "localhost",
  smtpPort: "1025",
  smtpFrom: "SignalDeck <briefing@localhost>",
};

describe("setupSchema", () => {
  it("accepts a valid Ollama setup with defaults", () => {
    const result = setupSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.smtpPort).toBe(1025);
      expect(result.data.ollamaBaseUrl).toBe("http://localhost:11434");
    }
  });

  it("requires an Anthropic key when provider is Claude", () => {
    const result = setupSchema.safeParse({ ...base, aiProvider: "anthropic" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) =>
        i.path.includes("anthropicApiKey"),
      );
      expect(issue).toBeDefined();
    }
  });

  it("accepts Claude when a key is supplied", () => {
    const result = setupSchema.safeParse({
      ...base,
      aiProvider: "anthropic",
      anthropicApiKey: "sk-ant-123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short passwords", () => {
    const result = setupSchema.safeParse({ ...base, password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = setupSchema.safeParse({ ...base, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("coerces a non-numeric port to a failure", () => {
    const result = setupSchema.safeParse({ ...base, smtpPort: "abc" });
    expect(result.success).toBe(false);
  });
});
