// Memory & preferences: the rules a user has taught SignalDeck. The
// classifier consults these on every message, so the brief learns ("mute
// newsletters from X", "Cameron is always high priority"). Everything is
// stored locally — preferences never leave the machine.

import { prisma } from "@/server/db/client";
import type { Insight } from "./parse";
import type { Rule } from "@/generated/prisma/client";

export type { Rule };
export type RuleKind = "mute" | "priority" | "note";

export function getActiveRules(userId: string): Promise<Rule[]> {
  return prisma.rule.findMany({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function addRule(
  userId: string,
  rule: { text: string; kind: RuleKind; subject: string },
): Promise<void> {
  await prisma.rule.create({
    data: {
      userId,
      text: rule.text.trim().slice(0, 280),
      kind: rule.kind,
      subject: rule.subject.trim().toLowerCase().slice(0, 120),
    },
  });
}

export async function deleteRule(userId: string, id: string): Promise<void> {
  await prisma.rule.deleteMany({ where: { id, userId } });
}

interface MessageLike {
  fromName: string;
  fromEmail: string;
  subject: string;
  snippet: string;
}

/** Does a rule's subject appear in the message (sender / address / text)? */
function matches(rule: Rule, m: MessageLike): boolean {
  const s = rule.subject;
  if (!s) return false;
  return (
    m.fromName.toLowerCase().includes(s) ||
    m.fromEmail.toLowerCase().includes(s) ||
    m.subject.toLowerCase().includes(s) ||
    m.snippet.toLowerCase().includes(s)
  );
}

/** A matching mute rule means we can skip the AI entirely for this message. */
export function muteMatch(rules: Rule[], m: MessageLike): boolean {
  return rules.some((r) => r.kind === "mute" && matches(r, m));
}

/** Apply priority rules on top of the AI's verdict (mutes handled earlier). */
export function applyPriorityRules(
  rules: Rule[],
  m: MessageLike,
  insight: Insight,
): Insight {
  const bump = rules.some((r) => r.kind === "priority" && matches(r, m));
  return bump ? { ...insight, priority: "high" } : insight;
}

/** "note" rules are passed to the model as preferences to weigh in. */
export function notesForPrompt(rules: Rule[]): string {
  const notes = rules.filter((r) => r.kind === "note").map((r) => `- ${r.text}`);
  return notes.length
    ? `\n\nThe user has given you these standing preferences — weigh them:\n${notes.join("\n")}`
    : "";
}
