// SignalDeck background worker entrypoint.
//
// Runs as a separate process from the web app (`npm run worker`). It owns
// scheduled connector syncs (and, in later phases, classification and
// briefing generation).

import { syncAllGmail } from "@/server/connectors/gmail/sync";
import { syncAllCalendars } from "@/server/connectors/calendar/sync";

const SYNC_INTERVAL_MS = 5 * 60_000; // every 5 minutes
let timer: NodeJS.Timeout | undefined;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // never overlap a slow sync with the next tick
  running = true;
  try {
    await syncAllGmail();
    await syncAllCalendars();
  } catch (error) {
    console.error("[worker] sync tick failed", error);
  } finally {
    running = false;
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

  await tick(); // sync once at startup
  timer = setInterval(tick, SYNC_INTERVAL_MS);
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
