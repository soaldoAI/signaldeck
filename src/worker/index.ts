// SignalDeck background worker entrypoint.
//
// Runs as a separate process from the web app (`npm run worker`). It owns
// scheduled connector syncs (and, in later phases, classification and
// briefing generation).

import { syncAllGmail } from "@/server/connectors/gmail/sync";
import { syncAllCalendars } from "@/server/connectors/calendar/sync";
import { syncAllTelegram } from "@/server/connectors/telegram/sync";
import { classifyPendingMessages } from "@/server/intelligence/classify";
import { processInboundTelegram } from "@/server/intelligence/learn";
import { maybeSendDailyBriefing } from "@/server/delivery/schedule";

const SYNC_INTERVAL_MS = 5 * 60_000; // every 5 minutes
let timer: NodeJS.Timeout | undefined;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // never overlap a slow sync with the next tick
  running = true;
  try {
    await syncAllGmail();
    await syncAllCalendars();
    await syncAllTelegram();
    // Classify whatever's new (bounded per tick so a big backlog is chipped
    // away rather than blocking one tick on a slow local model).
    const { classified } = await classifyPendingMessages(40);
    if (classified > 0) console.log(`[worker] classified ${classified} messages`);
    // Send the daily briefing if it's due (at most once per day).
    await maybeSendDailyBriefing();
  } catch (error) {
    console.error("[worker] sync tick failed", error);
  } finally {
    running = false;
  }
}

// Continuous Telegram long-poll: replies to the user near-instantly instead
// of waiting for the 5-minute sync tick. When the bot isn't configured, back
// off so we don't hot-loop.
async function telegramLoop(): Promise<void> {
  for (;;) {
    let active = false;
    try {
      active = await processInboundTelegram({ longPollSeconds: 30 });
    } catch (error) {
      console.error("[worker] telegram loop error", error);
    }
    if (!active) await new Promise((r) => setTimeout(r, 30_000));
  }
}

async function main(): Promise<void> {
  console.log("[worker] SignalDeck worker started");

  const shutdown = (signal: string): void => {
    console.log(`[worker] received ${signal}, shutting down`);
    if (timer) clearInterval(timer);
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  void telegramLoop(); // instant inbound handling, runs alongside the tick
  await tick(); // sync once at startup
  timer = setInterval(tick, SYNC_INTERVAL_MS);
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
