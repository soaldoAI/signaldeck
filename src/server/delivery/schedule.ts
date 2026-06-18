// Daily-briefing scheduler. Called on every worker tick; sends at most once
// per day, after the configured local hour. Idempotent via a per-day marker
// in settings (lastSentDate), so frequent ticks never double-send.

import { prisma } from "@/server/db/client";
import {
  getBriefingConfig,
  getTimezone,
  saveBriefingConfig,
} from "@/server/settings";
import { sendBriefing } from "./send";

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

  const result = await sendBriefing(user.id, recipient);
  if (result.ok) {
    await saveBriefingConfig({ lastSentDate: date });
    console.log(`[worker] daily briefing sent to ${recipient}`);
  } else {
    console.error(`[worker] daily briefing failed: ${result.detail}`);
  }
}
