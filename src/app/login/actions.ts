"use server";

import { redirect } from "next/navigation";
import {
  createSession,
  destroySession,
  isSetupComplete,
  verifyPassword,
} from "@/server/auth";
import { prisma } from "@/server/db/client";
import { loginSchema } from "@/server/validation";
import type { FormState } from "@/app/_lib/form-state";

/** Authenticate the admin and start a session. */
export async function login(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!(await isSetupComplete())) redirect("/setup");

  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Enter your email and password." };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  // Always run a verification to keep timing uniform whether or not the
  // email exists, then fail with one generic message either way.
  const dummyHash =
    "0".repeat(32) + ":" + "0".repeat(128);
  const ok = await verifyPassword(
    parsed.data.password,
    user?.passwordHash ?? dummyHash,
  );

  if (!user || !ok) {
    return { error: "Invalid email or password." };
  }

  await createSession(user.id);
  redirect("/");
}

/** End the current session. */
export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
