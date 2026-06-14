import type {
  AiProvider,
  GenerateRequest,
  GenerateResult,
  TestResult,
} from "../types";
import { errorMessage, fetchJson } from "./http";

// OpenAI provider over the Chat Completions API.
const API_URL = "https://api.openai.com/v1/chat/completions";
const MODELS_URL = "https://api.openai.com/v1/models";
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string } }>;
  model?: string;
}

export class OpenAiProvider implements AiProvider {
  readonly id = "openai" as const;
  readonly model: string;
  private readonly apiKey: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.apiKey = config.apiKey;
    this.model = config.model?.trim() || DEFAULT_OPENAI_MODEL;
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    // OpenAI carries the system prompt as a leading system message.
    const messages = request.system
      ? [{ role: "system", content: request.system }, ...request.messages]
      : request.messages;

    const { ok, status, body } = await fetchJson(API_URL, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1024,
        messages,
      }),
    });

    if (!ok) {
      throw new Error(`OpenAI API error (${status}): ${describe(body)}`);
    }

    const data = body as OpenAiResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
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
      if (ok) return { ok: true, detail: `Connected to OpenAI (${this.model})` };
      if (status === 401 || status === 403) {
        return { ok: false, detail: "Invalid API key" };
      }
      return { ok: false, detail: `OpenAI returned HTTP ${status}` };
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
