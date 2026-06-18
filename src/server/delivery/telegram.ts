// Telegram delivery — sends the brief to the user as a Telegram message via
// a bot (Bot API, a plain HTTPS call; no gramjs needed here). This is what
// makes "everything in one Telegram app" work: the brief lands in Telegram
// alongside the chats SignalDeck already reads.

import { getBotToken } from "@/server/settings";

const API = "https://api.telegram.org";

export async function telegramBotConfigured(): Promise<boolean> {
  return Boolean(await getBotToken());
}

async function botToken(): Promise<string> {
  const token = await getBotToken();
  if (!token) {
    throw new Error(
      "Telegram delivery isn't configured. Add a bot token in Settings " +
        "(see docs/telegram-setup.md → Deliver your brief to Telegram).",
    );
  }
  return token;
}

export interface TelegramSendResult {
  ok: boolean;
  detail: string;
}

/** Send an HTML message to a chat. */
export async function sendTelegramMessage(
  chatId: string,
  html: string,
): Promise<TelegramSendResult> {
  try {
    const res = await fetch(`${API}/bot${await botToken()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html.slice(0, 4096), // Telegram's per-message limit
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    const body = (await res.json()) as { ok: boolean; description?: string };
    return body.ok
      ? { ok: true, detail: "Sent to Telegram" }
      : { ok: false, detail: body.description ?? `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, detail: (error as Error).message };
  }
}

/**
 * Discover the chat id to deliver to: the most recent private chat that has
 * messaged the bot. The user just has to send their bot any message once.
 * Returns null if nobody has messaged the bot yet.
 */
export async function resolveChatId(): Promise<string | null> {
  const res = await fetch(`${API}/bot${await botToken()}/getUpdates`);
  const body = (await res.json()) as {
    ok: boolean;
    result?: Array<{ message?: { chat?: { id?: number; type?: string } } }>;
  };
  if (!body.ok || !body.result) return null;
  for (const update of [...body.result].reverse()) {
    const chat = update.message?.chat;
    if (chat?.type === "private" && typeof chat.id === "number") {
      return String(chat.id);
    }
  }
  return null;
}
