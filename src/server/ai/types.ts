// AI provider contract. Every feature that uses AI (classification,
// action extraction, briefing) goes through this interface — no module
// outside src/server/ai/ may import a provider SDK or call a provider's
// HTTP API directly. See README.md in this directory.

// Kept in sync with `AiProvider` in src/server/settings (same union). Defined
// here so the provider layer carries no runtime dependency on the settings/DB
// modules — it can be unit-tested without a database.
export type ProviderId = "anthropic" | "openai" | "ollama";

/** A single conversation turn. */
export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

/** A single-shot generation request. */
export interface GenerateRequest {
  /** Optional system prompt / instructions. */
  system?: string;
  messages: AiMessage[];
  /** Upper bound on output tokens. Defaults per provider. */
  maxTokens?: number;
}

export interface GenerateResult {
  text: string;
  /** The model that actually served the request. */
  model: string;
}

/** Result of a lightweight connectivity/credential check. */
export interface TestResult {
  ok: boolean;
  /** Human-readable detail for the setup wizard. */
  detail: string;
}

/** A configured AI backend. Implementations live in ./providers. */
export interface AiProvider {
  readonly id: ProviderId;
  /** The model used when a request doesn't override it. */
  readonly model: string;
  /** Generate text for the given request. Throws on transport/API error. */
  generate(request: GenerateRequest): Promise<GenerateResult>;
  /**
   * Validate that the provider is reachable and credentials work, without
   * spending tokens. Never throws — returns a structured result.
   */
  testConnection(): Promise<TestResult>;
}
