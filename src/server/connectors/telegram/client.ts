// Telegram (MTProto) client wrapper over gramjs. Reads recent messages
// from the user's dialogs into SignalDeck's normalised shape. Used by the
// login script and the worker sync — never imported by the Next app, so
// gramjs stays out of the web bundle.

import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

export interface TelegramConfig {
  apiId: number;
  apiHash: string;
}

export function telegramConfig(): TelegramConfig {
  const apiId = Number(process.env.TELEGRAM_API_ID);
  const apiHash = process.env.TELEGRAM_API_HASH ?? "";
  if (!apiId || !apiHash) {
    throw new Error(
      "Telegram is not configured. Set TELEGRAM_API_ID and TELEGRAM_API_HASH " +
        "(see docs/telegram-setup.md).",
    );
  }
  return { apiId, apiHash };
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_API_ID && process.env.TELEGRAM_API_HASH);
}

/** Create a (disconnected) client from a saved session string. */
export function createClient(session: string): TelegramClient {
  const { apiId, apiHash } = telegramConfig();
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 3,
  });
}

export interface TelegramMessage {
  externalId: string;
  threadId: string;
  fromName: string;
  subject: string;
  snippet: string;
  receivedAt: Date;
}

/**
 * Fetch recent text messages across the user's most recent conversations.
 * Bounded (dialogs × per-dialog) so a sync stays quick and the local model's
 * classification backlog stays manageable.
 */
export async function fetchRecentMessages(
  client: TelegramClient,
  options: { dialogs?: number; perDialog?: number } = {},
): Promise<TelegramMessage[]> {
  const dialogLimit = options.dialogs ?? 25;
  const perDialog = options.perDialog ?? 5;
  const out: TelegramMessage[] = [];

  const dialogs = await client.getDialogs({ limit: dialogLimit });
  for (const dialog of dialogs) {
    const chatTitle = dialog.title || "Telegram chat";
    const chatId = String(dialog.id ?? "");
    try {
      const messages = await client.getMessages(dialog.entity, {
        limit: perDialog,
      });
      for (const m of messages) {
        const text = (m.message ?? "").trim();
        if (!text) continue; // skip media-only / service messages
        out.push({
          externalId: `${chatId}_${m.id}`,
          threadId: chatId,
          fromName: chatTitle,
          subject: chatTitle,
          snippet: text.slice(0, 500),
          receivedAt: new Date((m.date ?? 0) * 1000),
        });
      }
    } catch {
      // Some dialogs (channels without history access) can't be read; skip.
    }
  }
  return out;
}
