// Shared server service: used by both the Next app and the background
// worker, so it must NOT carry `server-only` (which throws outside the
// RSC bundler). The `src/server/` convention plus its node: imports keep
// it out of client bundles.
import { prisma } from "@/server/db/client";
import { decryptSecret, encryptSecret } from "@/server/crypto/secrets";

// Typed accessor over the key-value `Setting` table. Callers use the
// strongly-typed config helpers below, never raw keys. Secret values
// are encrypted at rest transparently — a caller writes a plaintext API
// key and never thinks about ciphertext.

/** Keys whose values are encrypted at rest. */
const SECRET_KEYS = new Set<string>([
  "ai.anthropicApiKey",
  "ai.openaiApiKey",
  "smtp.password",
]);

async function readMany(keys: string[]): Promise<Map<string, string>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const out = new Map<string, string>();
  for (const row of rows) {
    out.set(row.key, row.encrypted ? decryptSecret(row.value) : row.value);
  }
  return out;
}

/**
 * Write a batch of settings. `undefined` values are skipped; empty
 * strings clear a value. Secrets are encrypted based on the key.
 */
async function writeMany(values: Record<string, string | undefined>): Promise<void> {
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined,
  ) as Array<[string, string]>;

  await prisma.$transaction(
    entries.map(([key, raw]) => {
      const secret = SECRET_KEYS.has(key);
      const value = secret && raw !== "" ? encryptSecret(raw) : raw;
      const encrypted = secret && raw !== "";
      return prisma.setting.upsert({
        where: { key },
        create: { key, value, encrypted },
        update: { value, encrypted },
      });
    }),
  );
}

// --- AI provider ----------------------------------------------------------

export type AiProvider = "anthropic" | "openai" | "ollama";

export interface AiConfig {
  provider: AiProvider;
  model: string;
  anthropicApiKey: string;
  openaiApiKey: string;
  ollamaBaseUrl: string;
}

export async function getAiConfig(): Promise<AiConfig> {
  const s = await readMany([
    "ai.provider",
    "ai.model",
    "ai.anthropicApiKey",
    "ai.openaiApiKey",
    "ai.ollamaBaseUrl",
  ]);
  return {
    provider: (s.get("ai.provider") as AiProvider) ?? "ollama",
    model: s.get("ai.model") ?? "",
    anthropicApiKey: s.get("ai.anthropicApiKey") ?? "",
    openaiApiKey: s.get("ai.openaiApiKey") ?? "",
    ollamaBaseUrl:
      s.get("ai.ollamaBaseUrl") ??
      process.env.OLLAMA_BASE_URL ??
      "http://localhost:11434",
  };
}

export async function saveAiConfig(config: {
  provider: AiProvider;
  model: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  ollamaBaseUrl?: string;
}): Promise<void> {
  await writeMany({
    "ai.provider": config.provider,
    "ai.model": config.model,
    "ai.anthropicApiKey": config.anthropicApiKey,
    "ai.openaiApiKey": config.openaiApiKey,
    "ai.ollamaBaseUrl": config.ollamaBaseUrl,
  });
}

// --- SMTP -----------------------------------------------------------------

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig> {
  const s = await readMany([
    "smtp.host",
    "smtp.port",
    "smtp.user",
    "smtp.password",
    "smtp.from",
  ]);
  return {
    host: s.get("smtp.host") ?? process.env.SMTP_HOST ?? "localhost",
    port: Number(s.get("smtp.port") ?? process.env.SMTP_PORT ?? "1025"),
    user: s.get("smtp.user") ?? "",
    password: s.get("smtp.password") ?? "",
    from:
      s.get("smtp.from") ??
      process.env.SMTP_FROM ??
      "SignalDeck <briefing@localhost>",
  };
}

export async function saveSmtpConfig(config: {
  host: string;
  port: number;
  user?: string;
  password?: string;
  from: string;
}): Promise<void> {
  await writeMany({
    "smtp.host": config.host,
    "smtp.port": String(config.port),
    "smtp.user": config.user,
    "smtp.password": config.password,
    "smtp.from": config.from,
  });
}
