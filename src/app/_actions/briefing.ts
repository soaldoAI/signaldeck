"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { getBriefingConfig } from "@/server/settings";
import { sendBriefing, sendBriefingToTelegram } from "@/server/delivery/send";

/** Mark a brief item handled — it drops out of the brief until new activity. */
export async function markDone(messageId: string): Promise<void> {
  const user = await requireUser();
  await prisma.message.updateMany({
    where: { id: messageId, account: { userId: user.id } },
    data: { dismissedAt: new Date() },
  });
  revalidatePath("/");
}

// Sends the current brief to the user immediately, so delivery can be
// verified without waiting for the morning schedule.
export async function sendTestBriefing(): Promise<void> {
  const user = await requireUser();
  const config = await getBriefingConfig();
  const recipient = config.recipient || user.email;
  const result = await sendBriefing(user.id, recipient);
  redirect(result.ok ? "/?briefing=sent" : "/?briefing=failed");
}

/** Deliver the current brief to Telegram now (resolves the chat on first use). */
export async function sendTestBriefingTelegram(): Promise<void> {
  const user = await requireUser();
  const result = await sendBriefingToTelegram(user.id);
  redirect(result.ok ? "/?briefing=tg-sent" : "/?briefing=tg-failed");
}
