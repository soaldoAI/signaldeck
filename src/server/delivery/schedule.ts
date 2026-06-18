// Daily-briefing scheduler. Called on every worker tick; sends at most once
// per day, after the configured local hour. Idempotent via a per-day marker
// in settings (lastSentDate), so frequent ticks never double-send.

import { prisma } from "@/server/db/client";
import {
  getBriefingConfig,
  getTimezone,
  saveBriefingConfig,
} from "@/server/settings";
import { sendBriefing, sendBriefingToTelegram } from "./send";
import { telegramBotConfigured } from "./telegram";

/** Current local date (YYYY-MM-DD) and hour (0–23) in the given timezone. */
function nowInTimezone(timezone: string): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

/** Send today's briefing if it's due and hasn't been sent yet. */
export async function maybeSendDailyBriefing(): Promise<void> {
  const config = await getBriefingConfig();
  if (!config.enabled) return;

  const { date, hour } = nowInTimezone(await getTimezone());
  if (hour < config.hour) return; // before the send time today
  if (config.lastSentDate === date) return; // already sent today

  const user = await prisma.user.findFirst();
  if (!user) return;
  const recipient = config.recipient || user.email;

  // Deliver to every configured channel. Email is always available; Telegram
  // when a bot is set up. (WhatsApp delivery is a future method on this same
  // seam.) The day is marked sent if at least one channel succeeds.
  const results: string[] = [];
  let anyOk = false;

  const email = await sendBriefing(user.id, recipient);
  results.push(`email:${email.ok ? "ok" : email.detail}`);
  anyOk ||= email.ok;

  if (await telegramBotConfigured()) {
    const tg = await sendBriefingToTelegram(user.id);
    results.push(`telegram:${tg.ok ? "ok" : tg.detail}`);
    anyOk ||= tg.ok;
  }

  if (anyOk) await saveBriefingConfig({ lastSentDate: date });
  console.log(`[worker] daily briefing — ${results.join(", ")}`);
}
