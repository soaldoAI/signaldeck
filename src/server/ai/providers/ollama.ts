import type {
  AiProvider,
  GenerateRequest,
  GenerateResult,
  TestResult,
} from "../types";
import { errorMessage, fetchJson } from "./http";

// Ollama provider — local, fully private inference. The privacy-first
// default: with Ollama, message content never leaves the machine.
export const DEFAULT_OLLAMA_MODEL = "llama3.1";
const DEFAULT_BASE_URL = "http://localhost:11434";

interface OllamaResponse {
  message?: { content?: string };
  model?: string;
}
interface OllamaTags {
  models?: Array<{ name?: string }>;
}

export class OllamaProvider implements AiProvider {
  readonly id = "ollama" as const;
  readonly model: string;
  private readonly baseUrl: string;

  constructor(config: { baseUrl?: string; model?: string }) {
    this.baseUrl = (config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(
      /\/+$/,
      "",
    );
    this.model = config.model?.trim() || DEFAULT_OLLAMA_MODEL;
  }

  async generate(request: GenerateRequest): Promise<GenerateResult> {
    const messages = request.system
      ? [{ role: "system", content: request.system }, ...request.messages]
      : request.messages;

    const { ok, status, body } = await fetchJson(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: this.model, messages, stream: false }),
    });

    if (!ok) {
      throw new Error(`Ollama error (${status}): ${describe(body)}`);
    }

    const data = body as OllamaResponse;
    return { text: data.message?.content ?? "", model: data.model ?? this.model };
  }

  async testConnection(): Promise<TestResult> {
    try {
      const { ok, status, body } = await fetchJson(
        `${this.baseUrl}/api/tags`,
        { method: "GET" },
        10_000,
      );
      if (!ok) {
        return { ok: false, detail: `Ollama returned HTTP ${status}` };
      }
      const models = (body as OllamaTags).models ?? [];
      const names = models.map((m) => m.name ?? "");
      const hasModel = names.some(
        (n) => n === this.model || n.startsWith(`${this.model}:`),
      );
      if (!hasModel) {
        return {
          ok: false,
          detail: `Connected, but model "${this.model}" is not pulled. Run: ollama pull ${this.model}`,
        };
      }
      return { ok: true, detail: `Connected to Ollama (${this.model})` };
    } catch (error) {
      return {
        ok: false,
        detail: `${errorMessage(error)} — is Ollama running at ${this.baseUrl}?`,
      };
    }
  }
}

function describe(body: unknown): string {
  if (body && typeof body === "object" && "error" in body) {
    const err = (body as { error?: unknown }).error;
    if (typeof err === "string") return err;
  }
  return typeof body === "string" ? body.slice(0, 200) : "unknown error";
}
