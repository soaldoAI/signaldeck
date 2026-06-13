// SignalDeck background worker entrypoint.
//
// Runs as a separate process from the web app (`npm run worker`).
// From Phase 4 onwards this process owns connector syncs, AI
// classification, and briefing generation. Jobs are registered here
// as those milestones land.

async function main(): Promise<void> {
  console.log("[worker] SignalDeck worker started");

  const shutdown = (signal: string): void => {
    console.log(`[worker] received ${signal}, shutting down`);
    process.exit(0);
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // Keep the process alive. Job scheduling replaces this in Phase 4.
  await new Promise(() => {});
}

main().catch((error) => {
  console.error("[worker] fatal error", error);
  process.exit(1);
});
