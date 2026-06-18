// Classification engine: the AI's read of each message. Runs every
// not-yet-classified message through the configured provider and stores a
// MessageInsight. Provider-agnostic (llama3.1, Claude, OpenAI) via the AI
// abstraction. Shared by the worker — no `server-only` / `next/*` imports.

import { prisma } from "@/server/db/client";
import { getAiProvider, type AiProvider } from "@/server/ai";
import { parseInsight, type Insight } from "./parse";
import {
  applyPriorityRules,
  getActiveRules,
  muteMatch,
  notesForPrompt,
  type Rule,
} from "./memory";
import type { Message } from "@/generated/prisma/client";

export { CATEGORIES, type Category, type Insight } from "./parse";

const SYSTEM_PROMPT = `You are SignalDeck, an AI chief of staff for a busy professional.
For each message, decide how it should be triaged, how much it matters, and what (if anything) the user must do.

Reply with ONLY a JSON object, no prose, no markdown fences:
{
  "category": one of "needs_reply" | "waiting" | "urgent" | "fyi" | "ignore",
  "priority": one of "high" | "medium" | "low",
  "summary": a single short sentence describing what this message is,
  "action": the one concrete next action the user should take, or "" if none
}

Category guide:
- "urgent": time-sensitive and important; needs attention soon.
- "needs_reply": a real person is waiting on the user's response.
- "waiting": the user is waiting on someone else; no action needed now.
- "fyi": worth knowing, but no action required.
- "ignore": newsletters, promotions, automated notifications, noise.

Priority guide (be selective — most things are NOT high):
- "high": real consequences if missed today — a person blocked on you, a deadline, money, a contract, a key relationship.
- "medium": matters, but can wait a day or two.
- "low": routine, FYI, or noise.

Keep summary under 15 words. Keep action a short imperative ("Reply to Sarah about the contract") or "".`;

function buildUserPrompt(message: Message): string {
  return [
    `From: ${message.fromName || message.fromEmail} <${message.fromEmail}>`,
    `Subject: ${message.subject}`,
    `Preview: ${message.snippet}`,
  ].join("\n");
}

/**
 * Classify a single message, consulting the user's memory/rules:
 *  - a matching "mute" rule skips the AI entirely (→ ignore),
 *  - "note" rules are given to the model as standing preferences,
 *  - "priority" rules override the model's priority afterwards.
 */
export async function classifyMessage(
  provider: AiProvider,
  message: Message,
  rules: Rule[] = [],
): Promise<Insight> {
  if (muteMatch(rules, message)) {
    return { category: "ignore", priority: "low", summary: "Muted by your rule", action: "" };
  }
  const result = await provider.generate({
    system: SYSTEM_PROMPT + notesForPrompt(rules),
    messages: [{ role: "user", content: buildUserPrompt(message) }],
    maxTokens: 300,
  });
  return applyPriorityRules(rules, message, parseInsight(result.text));
}

export interface ClassifyResult {
  classified: number;
}

/**
 * Classify all messages that don't yet have an insight. Runs sequentially
 * to be gentle on a local model. `limit` bounds one batch so a huge backlog
 * is chipped away across worker ticks rather than blocking one tick forever.
 */
export async function classifyPendingMessages(
  limit = 25,
): Promise<ClassifyResult> {
  const pending = await prisma.message.findMany({
    where: { insight: null },
    orderBy: { receivedAt: "desc" },
    take: limit,
  });
  if (pending.length === 0) return { classified: 0 };

  const provider = await getAiProvider();
  // Single-admin instance: load the admin's rules once for this batch.
  const user = await prisma.user.findFirst();
  const rules = user ? await getActiveRules(user.id) : [];
  let classified = 0;

  for (const message of pending) {
    try {
      const insight = await classifyMessage(provider, message, rules);
      await prisma.messageInsight.create({
        data: {
          messageId: message.id,
          category: insight.category,
          priority: insight.priority,
          summary: insight.summary,
          action: insight.action,
          model: provider.model,
        },
      });
      classified += 1;
    } catch (error) {
      console.error(`[classify] failed for message ${message.id}`, error);
      // Leave it unclassified; the next tick retries it.
    }
  }
  return { classified };
}
