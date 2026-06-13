# syntax=docker/dockerfile:1

# --- Base -----------------------------------------------------------------
FROM node:22-alpine AS base
WORKDIR /app
# Prisma needs OpenSSL; Alpine is otherwise minimal.
RUN apk add --no-cache openssl

# --- Dependencies ---------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# `npm ci` runs postinstall (prisma generate), so the schema is needed.
RUN npm ci

# --- Build ----------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run db:generate && npm run build

# --- Runtime: web app -----------------------------------------------------
# Lean standalone bundle. Database migrations are handled by the separate
# one-shot `migrate` service (see docker-compose.yml), so this image needs
# no Prisma CLI — keeping it small.
FROM base AS app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]

# --- Runtime: worker / migrations ----------------------------------------
# Carries the full dependency tree (tsx + Prisma CLI). Runs the background
# worker by default; the compose `migrate` service overrides the command
# to `npm run db:deploy`.
FROM base AS worker
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
CMD ["npm", "run", "worker"]
