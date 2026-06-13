// SignalDeck background worker entrypoint.
//
// Runs as a separate process from the web app (`npm run worker`).
// From Phase 4 onwards this process owns connector syncs, AI
// classification, and briefing generation. Jobs are registered here
// as those milestones land.

// Heartbeat interval that keeps the event loop alive. From Phase 4 this
// becomes the scheduler tick; for now it is a no-op that holds the
// process open (an unsettled promise does NOT keep Node running).
const HEARTBEAT_MS = 60_000;
let heartbeat: NodeJS.Timeout | undefined;

async function main(): Promise<void> {
  console.log("[worker] SignalDeck worker started");

  const shutdown = (signal: string): void => {
    console.log(`[worker] received ${signal}, shutting down`);
    if (heartbeat) clearInterval(heartbeat);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  heartbeat = setInterval(() => {
    // Scheduler tick lands in Phase 4.
  }, HEARTBEAT_MS);
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
