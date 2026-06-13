import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (.next/standalone).
  output: "standalone",

  // Prisma 7's query compiler ships as base64-wasm JS modules loaded at
  // runtime; force them into the traced output so the standalone server
  // can talk to Postgres inside the container.
  outputFileTracingIncludes: {
    "*": ["./node_modules/@prisma/client/runtime/*"],
  },
};

export default nextConfig;
