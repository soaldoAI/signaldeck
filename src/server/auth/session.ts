import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/server/db/client";
import type { User } from "@/generated/prisma/client";

// Database-backed sessions. The browser cookie holds an opaque random
// token; the database stores only its SHA-256 hash, so a database leak
// cannot be replayed as a login. Sessions are revocable (delete the row)
// — an advantage over stateless JWTs for a security-sensitive product.

const COOKIE_NAME = "signaldeck_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Mark the cookie Secure only when the app is actually served over HTTPS.
// Self-hosted, local-first deployments are commonly reached over plain
// HTTP on a LAN address, where a Secure cookie would be silently dropped
// by the browser and break login. APP_URL is the source of truth.
function secureCookieEnabled(): boolean {
  return (process.env.APP_URL ?? "").startsWith("https://");
}

/** Create a session for the user and set the session cookie. */
export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: secureCookieEnabled(),
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

/**
 * Resolve the current user from the session cookie, or null. Memoised
 * per request with React `cache` so multiple callers share one query.
 * Expired sessions are treated as absent and cleaned up.
 */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
});

/** Destroy the current session (logout). Safe to call when not logged in. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session
      .deleteMany({ where: { tokenHash: hashToken(token) } })
      .catch(() => {});
  }
  cookieStore.delete(COOKIE_NAME);
}
