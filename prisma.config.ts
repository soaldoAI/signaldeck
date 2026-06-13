import fs from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer loads .env automatically for CLI commands. In Docker
// the env comes from the container, so only load a file if present.
if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Read directly (not via prisma's `env()` helper, which throws when
    // unset) so `prisma generate` works at build time without a database.
    // Commands that actually connect (migrate deploy) get it at runtime.
    url: process.env.DATABASE_URL ?? "",
  },
});
