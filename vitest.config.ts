import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests cover pure, security-critical logic (hashing, encryption,
// validation, parsing). Integration tests that need a database are added
// per connector phase with their own harness.
export default defineConfig({
  resolve: {
    // Match the tsconfig `@/*` path alias so runtime imports resolve.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
