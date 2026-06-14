// AI provider abstraction — the single entry point for all AI usage.
// Callers use createProvider() (explicit config) or getAiProvider()
// (config from the encrypted settings store). See README.md.

import { getAiConfig, type AiConfig } from "@/server/settings";
import { createProvider } from "./factory";
import type { AiProvider } from "./types";

export type {
  AiProvider,
  AiMessage,
  GenerateRequest,
  GenerateResult,
  TestResult,
  ProviderId,
} from "./types";
export { createProvider, type ProviderConfig } from "./factory";
export { DEFAULT_ANTHROPIC_MODEL } from "./providers/anthropic";
export { DEFAULT_OPENAI_MODEL } from "./providers/openai";
export { DEFAULT_OLLAMA_MODEL } from "./providers/ollama";

/** The configured provider, built from the encrypted settings store. */
export async function getAiProvider(): Promise<AiProvider> {
  const config: AiConfig = await getAiConfig();
  return createProvider({
    provider: config.provider,
    model: config.model,
    anthropicApiKey: config.anthropicApiKey,
    openaiApiKey: config.openaiApiKey,
    ollamaBaseUrl: config.ollamaBaseUrl,
  });
}
