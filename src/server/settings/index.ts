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
  "google.clientSecret",
  "telegram.botToken",
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

// --- General -------------------------------------------------------------

/**
 * The user's IANA timezone, used to render dates (calendar, briefing) in
 * local time rather than the server's UTC. Falls back to APP_TIMEZONE then
 * UTC. Set via the (future) settings UI; seedable meanwhile.
 */
export async function getTimezone(): Promise<string> {
  const s = await readMany(["app.timezone"]);
  return s.get("app.timezone") || process.env.APP_TIMEZONE || "UTC";
}

// --- Daily briefing -------------------------------------------------------

export interface BriefingConfig {
  enabled: boolean;
  /** Local hour (0–23) to send the daily briefing. */
  hour: number;
  /** Recipient email; empty means "use the admin's login email". */
  recipient: string;
  /** YYYY-MM-DD (local) of the last send, to avoid double-sending. */
  lastSentDate: string;
}

export async function getBriefingConfig(): Promise<BriefingConfig> {
  const s = await readMany([
    "briefing.enabled",
    "briefing.hour",
    "briefing.recipient",
    "briefing.lastSentDate",
  ]);
  const hour = Number(s.get("briefing.hour") ?? "7");
  return {
    enabled: (s.get("briefing.enabled") ?? "true") !== "false",
    hour: Number.isFinite(hour) ? hour : 7,
    recipient: s.get("briefing.recipient") ?? "",
    lastSentDate: s.get("briefing.lastSentDate") ?? "",
  };
}

export async function saveBriefingConfig(config: {
  enabled?: boolean;
  hour?: number;
  recipient?: string;
  lastSentDate?: string;
}): Promise<void> {
  await writeMany({
    "briefing.enabled":
      config.enabled === undefined ? undefined : String(config.enabled),
    "briefing.hour": config.hour === undefined ? undefined : String(config.hour),
    "briefing.recipient": config.recipient,
    "briefing.lastSentDate": config.lastSentDate,
  });
}

// --- Connection credentials (settable in the UI; env as fallback) ---------
// Stored in the DB (secrets encrypted) so users paste them in the app
// instead of editing .env and restarting. Env vars remain a fallback for
// scripted/headless deploys.

export interface GoogleCredentials {
  clientId: string;
  clientSecret: string;
}

export async function getGoogleCredentials(): Promise<GoogleCredentials> {
  // DB-stored values win; env is the fallback (and the safety net if the DB
  // is unreachable, so OAuth keeps working).
  const s = await readMany([
    "google.clientId",
    "google.clientSecret",
  ]).catch(() => new Map<string, string>());
  return {
    clientId: s.get("google.clientId") || process.env.GOOGLE_CLIENT_ID || "",
    clientSecret:
      s.get("google.clientSecret") || process.env.GOOGLE_CLIENT_SECRET || "",
  };
}

export async function saveGoogleCredentials(creds: {
  clientId: string;
  clientSecret?: string;
}): Promise<void> {
  await writeMany({
    "google.clientId": creds.clientId,
    // undefined = leave the stored secret untouched (so a blank field in the
    // form doesn't wipe a saved secret).
    "google.clientSecret": creds.clientSecret || undefined,
  });
}

export async function getBotToken(): Promise<string> {
  const s = await readMany(["telegram.botToken"]).catch(
    () => new Map<string, string>(),
  );
  return s.get("telegram.botToken") || process.env.TELEGRAM_BOT_TOKEN || "";
}

export async function saveBotToken(token: string): Promise<void> {
  await writeMany({ "telegram.botToken": token || undefined });
}

// --- Telegram delivery ----------------------------------------------------

/** The chat id the brief is delivered to (resolved once from getUpdates). */
export async function getTelegramChatId(): Promise<string> {
  return (await readMany(["delivery.telegram.chatId"])).get(
    "delivery.telegram.chatId",
  ) ?? "";
}

export async function setTelegramChatId(chatId: string): Promise<void> {
  await writeMany({ "delivery.telegram.chatId": chatId });
}

/** getUpdates cursor so inbound bot messages are processed exactly once. */
export async function getTelegramOffset(): Promise<number> {
  return Number(
    (await readMany(["telegram.updateOffset"])).get("telegram.updateOffset") || "0",
  );
}

export async function setTelegramOffset(offset: number): Promise<void> {
  await writeMany({ "telegram.updateOffset": String(offset) });
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
