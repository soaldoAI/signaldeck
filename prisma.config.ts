import fs from "node:fs";
import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer loads .env automatically for CLI commands.
if (fs.existsSync(".env")) {
  process.loadEnvFile(".env");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
