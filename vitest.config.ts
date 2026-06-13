import { defineConfig } from "vitest/config";

// Unit tests cover pure, security-critical logic (hashing, encryption,
// validation). Integration tests that need a database are added per
// connector phase with their own harness.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
