"use server";

import { createProvider, type TestResult } from "@/server/ai";
import { aiProviderSchema } from "@/server/validation";

// Validates the AI provider the user has entered in the wizard, before
// setup is submitted, so they get an immediate first-success signal. Uses
// the unsaved form values directly (nothing is persisted by this action).
export async function testAiConnection(input: {
  provider: string;
  model?: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}): Promise<TestResult> {
  const parsed = aiProviderSchema.safeParse(input.provider);
  if (!parsed.success) {
    return { ok: false, detail: "Choose an AI provider first" };
  }

  const provider = createProvider({
    provider: parsed.data,
    model: input.model,
    anthropicApiKey: input.anthropicApiKey,
    openaiApiKey: input.openaiApiKey,
    ollamaBaseUrl: input.ollamaBaseUrl,
  });
  return provider.testConnection();
}
