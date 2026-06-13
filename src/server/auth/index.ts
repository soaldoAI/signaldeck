import "server-only";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db/client";
import type { User } from "@/generated/prisma/client";
import { getSessionUser } from "./session";

// Auth facade: the rest of the app imports guards from here, not the
// session/password internals.

export { createSession, destroySession, getSessionUser } from "./session";
export { hashPassword, verifyPassword } from "./password";

/** True once the single admin account exists (i.e. setup is complete). */
export async function isSetupComplete(): Promise<boolean> {
  const count = await prisma.user.count();
  return count > 0;
}

/**
 * Require an authenticated user in a server component or action.
 * Redirects to setup if the instance is unconfigured, otherwise to
 * login. Returns the user when present.
 */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (user) return user;

  if (!(await isSetupComplete())) redirect("/setup");
  redirect("/login");
}
