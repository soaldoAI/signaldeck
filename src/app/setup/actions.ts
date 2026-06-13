"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSession, hashPassword, isSetupComplete } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { saveAiConfig, saveSmtpConfig } from "@/server/settings";
import { setupSchema } from "@/server/validation";
import type { FormState } from "@/app/_lib/form-state";

function fieldErrors(error: z.ZodError): FormState {
  return { fieldErrors: z.flattenError(error).fieldErrors };
}

/**
 * First-run setup: create the single admin account, persist AI and SMTP
 * configuration, then sign the user in. Settings are written before the
 * user row so that a partial failure leaves setup cleanly incomplete and
 * retryable (no user => wizard still shows).
 */
export async function completeSetup(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (await isSetupComplete()) {
    return { error: "SignalDeck is already set up. Please sign in." };
  }

  const parsed = setupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fieldErrors(parsed.error);
  const data = parsed.data;

  let userId: string;
  try {
    await saveAiConfig({
      provider: data.aiProvider,
      model: data.aiModel,
      anthropicApiKey: data.anthropicApiKey,
      openaiApiKey: data.openaiApiKey,
      ollamaBaseUrl: data.ollamaBaseUrl,
    });
    await saveSmtpConfig({
      host: data.smtpHost,
      port: data.smtpPort,
      user: data.smtpUser,
      password: data.smtpPassword,
      from: data.smtpFrom,
    });

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash: await hashPassword(data.password),
      },
    });
    userId = user.id;

    await createSession(userId);
  } catch (error) {
    return { error: `Could not complete setup: ${(error as Error).message}` };
  }

  redirect("/");
}
