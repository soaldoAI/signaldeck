import { afterEach, describe, expect, it, vi } from "vitest";
// Import from the factory (not ./index) so these unit tests don't pull in
// the settings/DB chain that getAiProvider() depends on.
import { createProvider } from "./factory";
import { DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic";
import { DEFAULT_OPENAI_MODEL } from "./providers/openai";
import { DEFAULT_OLLAMA_MODEL } from "./providers/ollama";

// Helper: stub global fetch with a single scripted response and capture
// the request the provider made.
function stubFetch(response: {
  ok: boolean;
  status?: number;
  body: unknown;
}) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 400),
      text: async () => JSON.stringify(response.body),
    } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createProvider", () => {
  it("selects the provider by id with its default model", () => {
    expect(createProvider({ provider: "anthropic" }).id).toBe("anthropic");
    expect(createProvider({ provider: "anthropic" }).model).toBe(
      DEFAULT_ANTHROPIC_MODEL,
    );
    expect(createProvider({ provider: "openai" }).model).toBe(
      DEFAULT_OPENAI_MODEL,
    );
    expect(createProvider({ provider: "ollama" }).model).toBe(
      DEFAULT_OLLAMA_MODEL,
    );
  });

  it("honours an explicit model override", () => {
    const p = createProvider({ provider: "anthropic", model: "claude-opus-4-8" });
    expect(p.model).toBe("claude-opus-4-8");
  });
});

describe("AnthropicProvider", () => {
  it("builds a Messages API request and extracts text", async () => {
    const calls = stubFetch({
      ok: true,
      body: { content: [{ type: "text", text: "hello" }], model: "claude-haiku-4-5" },
    });
    const provider = createProvider({
      provider: "anthropic",
      anthropicApiKey: "sk-ant-test",
    });
    const result = await provider.generate({
      system: "be brief",
      messages: [{ role: "user", content: "hi" }],
    });

    expect(result.text).toBe("hello");
    expect(calls[0].url).toContain("/v1/messages");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.model).toBe(DEFAULT_ANTHROPIC_MODEL);
    expect(sent.system).toBe("be brief");
    // No sampling params that would 400 on newer models.
    expect(sent).not.toHaveProperty("temperature");
  });

  it("throws on a non-ok response", async () => {
    stubFetch({ ok: false, status: 400, body: { error: { message: "bad" } } });
    const provider = createProvider({ provider: "anthropic", anthropicApiKey: "x" });
    await expect(
      provider.generate({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/bad/);
  });

  it("throws when the model refuses", async () => {
    stubFetch({ ok: true, body: { content: [], stop_reason: "refusal" } });
    const provider = createProvider({ provider: "anthropic", anthropicApiKey: "x" });
    await expect(
      provider.generate({ messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow(/declined/);
  });

  it("reports an invalid key from testConnection without throwing", async () => {
    stubFetch({ ok: false, status: 401, body: {} });
    const result = await createProvider({
      provider: "anthropic",
      anthropicApiKey: "wrong",
    }).testConnection();
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/invalid api key/i);
  });
});

describe("OpenAiProvider", () => {
  it("prepends the system prompt as a system message and parses choices", async () => {
    const calls = stubFetch({
      ok: true,
      body: { choices: [{ message: { content: "yo" } }], model: "gpt-4o-mini" },
    });
    const result = await createProvider({
      provider: "openai",
      openaiApiKey: "sk-test",
    }).generate({
      system: "sys",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(result.text).toBe("yo");
    const sent = JSON.parse(calls[0].init.body as string);
    expect(sent.messages[0]).toEqual({ role: "system", content: "sys" });
  });
});

describe("OllamaProvider", () => {
  it("flags a model that is not pulled", async () => {
    stubFetch({ ok: true, body: { models: [{ name: "mistral" }] } });
    const result = await createProvider({
      provider: "ollama",
      model: "llama3.1",
    }).testConnection();
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/ollama pull llama3\.1/);
  });

  it("passes when the model is present", async () => {
    stubFetch({ ok: true, body: { models: [{ name: "llama3.1:latest" }] } });
    const result = await createProvider({
      provider: "ollama",
      model: "llama3.1",
    }).testConnection();
    expect(result.ok).toBe(true);
  });
});
