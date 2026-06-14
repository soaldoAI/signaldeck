// Provider construction from an explicit config. Kept free of any
// settings/DB import so the provider layer is unit-testable without a
// database; the settings-backed entry point lives in ./index.

import { AnthropicProvider } from "./providers/anthropic";
import { OpenAiProvider } from "./providers/openai";
import { OllamaProvider } from "./providers/ollama";
import type { AiProvider, ProviderId } from "./types";

export interface ProviderConfig {
  provider: ProviderId;
  model?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}

/** Build a provider from an explicit config (e.g. unsaved wizard input). */
export function createProvider(config: ProviderConfig): AiProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider({
        apiKey: config.anthropicApiKey ?? "",
        model: config.model,
      });
    case "openai":
      return new OpenAiProvider({
        apiKey: config.openaiApiKey ?? "",
        model: config.model,
      });
    case "ollama":
      return new OllamaProvider({
        baseUrl: config.ollamaBaseUrl,
        model: config.model,
      });
    default: {
      // Exhaustiveness guard: a new provider must be handled here.
      const never: never = config.provider;
      throw new Error(`Unsupported AI provider: ${String(never)}`);
    }
  }
}
