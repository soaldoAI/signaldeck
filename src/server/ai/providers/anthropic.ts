import type {
  AiProvider,
  GenerateRequest,
  GenerateResult,
  TestResult,
} from "../types";
import { errorMessage, fetchJson } from "./http";

// Anthropic (Claude) provider over the Messages API. Cost-effective
// default for SignalDeck's high-volume classification; override the model
// in the setup wizard for higher-tier work.
const API_URL = "https://api.anthropic.com/v1/messages";
const MODELS_URL = "https://api.anthropic.com/v1/models";
const API_VERSION = "2023-06-01";
export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";

interface AnthropicTextBlock {
  type: string;
  text?: string;
}
interface AnthropicResponse {
  content?: AnthropicTextBlock[];
  model?: string;
  stop_reason?: string;
}

export class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model?.trim() || DEFAULT_ANTHROPIC_MODEL;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      "x-api-key": this.apiKey,
      "anthropic-version": API_VERSION,
    };
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    // No temperature/thinking params: keeps the request valid across every
    // current Claude model generation (newer models reject them).
    const { ok, status, body } = await fetchJson(API_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1024,
        system: request.system,
        messages: request.messages,
      }),
    });

    if (!ok) {
      throw new Error(`Anthropic API error (${status}): ${describe(body)}`);
    }

    const data = body as AnthropicResponse;
    if (data.stop_reason === "refusal") {
      throw new Error("Anthropic declined to respond to this request");
    }
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text)
      .join("");
    return { text, model: data.model ?? this.model };
  }

  async testConnection(): Promise<TestResult> {
    if (!this.apiKey) return { ok: false, detail: "No API key provided" };
    try {
      const { ok, status } = await fetchJson(
        MODELS_URL,
        { method: "GET", headers: this.headers() },
        10_000,
      );
      if (ok) return { ok: true, detail: `Connected to Claude (${this.model})` };
      if (status === 401 || status === 403) {
        return { ok: false, detail: "Invalid API key" };
      }
      return { ok: false, detail: `Anthropic returned HTTP ${status}` };
    } catch (error) {
      return { ok: false, detail: errorMessage(error) };
    }
  }
}

function describe(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: { message?: string } }).error;
    if (err?.message) return err.message;
  }
  return typeof body === "string" ? body.slice(0, 200) : "unknown error";
}
