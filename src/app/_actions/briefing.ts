"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getBriefingConfig } from "@/server/settings";
import { sendBriefing } from "@/server/delivery/send";

// Sends the current brief to the user immediately, so delivery can be
// verified without waiting for the morning schedule.
export async function sendTestBriefing(): Promise<void> {
  const user = await requireUser();
  const config = await getBriefingConfig();
  const recipient = config.recipient || user.email;
  const result = await sendBriefing(user.id, recipient);
  redirect(result.ok ? "/?briefing=sent" : "/?briefing=failed");
}
