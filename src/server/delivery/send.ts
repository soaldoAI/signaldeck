// Build → render → deliver a briefing. Phase 9 delivers by email (SMTP);
// the renderer output is reused as future delivery methods (Gmail API,
// Telegram) land.

import { getBrief } from "@/server/intelligence/brief";
import {
  getTelegramChatId,
  getTimezone,
  setTelegramChatId,
} from "@/server/settings";
import { sendMail } from "@/server/mail/mailer";
import { renderBriefing, renderBriefingTelegram } from "./render";
import {
  resolveChatId,
  sendTelegramMessage,
  telegramBotConfigured,
} from "./telegram";

export interface SendBriefingResult {
  ok: boolean;
  detail: string;
}

/** Render the user's current brief and email it to `recipient`. */
export async function sendBriefing(
  userId: string,
  recipient: string,
): Promise<SendBriefingResult> {
  if (!recipient) return { ok: false, detail: "No recipient address" };

  const [brief, timezone] = await Promise.all([getBrief(userId), getTimezone()]);
  const rendered = renderBriefing(brief, timezone);

  const result = await sendMail({
    to: recipient,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
  return result.ok
    ? { ok: true, detail: `Briefing sent to ${recipient}` }
    : { ok: false, detail: result.error ?? "Send failed" };
}

/**
 * Deliver the brief to Telegram. Resolves the chat id on first use (the
 * user just needs to have messaged their bot once), then stores it.
 */
export async function sendBriefingToTelegram(
  userId: string,
): Promise<SendBriefingResult> {
  if (!(await telegramBotConfigured())) {
    return { ok: false, detail: "Telegram bot not configured" };
  }

  let chatId = await getTelegramChatId();
  if (!chatId) {
    const resolved = await resolveChatId();
    if (!resolved) {
      return {
        ok: false,
        detail: "Send your bot any message first, then try again.",
      };
    }
    chatId = resolved;
    await setTelegramChatId(chatId);
  }

  const [brief, timezone] = await Promise.all([getBrief(userId), getTimezone()]);
  return sendTelegramMessage(chatId, renderBriefingTelegram(brief, timezone));
}
