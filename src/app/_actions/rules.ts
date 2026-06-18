"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth";
import { prisma } from "@/server/db/client";
import { addRule, deleteRule, type RuleKind } from "@/server/intelligence/memory";

// Re-evaluate messages a new rule touches so it takes effect on the brief.
async function reclassify(userId: string, subject: string): Promise<void> {
  if (!subject.trim()) return;
  await prisma.messageInsight.deleteMany({
    where: {
      message: {
        account: { userId },
        OR: [
          { fromName: { contains: subject, mode: "insensitive" } },
          { fromEmail: { contains: subject, mode: "insensitive" } },
          { subject: { contains: subject, mode: "insensitive" } },
        ],
      },
    },
  });
}

export async function addRuleAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const kind = String(formData.get("kind") || "mute") as RuleKind;
  const subject = String(formData.get("subject") || "").trim();
  if (subject) {
    const label = kind === "mute" ? "Mute" : kind === "priority" ? "Prioritise" : "Note";
    await addRule(user.id, { text: `${label}: ${subject}`, kind, subject });
    await reclassify(user.id, subject);
  }
  revalidatePath("/");
}

export async function deleteRuleAction(id: string): Promise<void> {
  const user = await requireUser();
  await deleteRule(user.id, id);
  revalidatePath("/");
}
