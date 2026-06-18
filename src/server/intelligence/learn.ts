// The learning loop. Reads what the user texts the bot, turns each message
// into a durable rule (via the AI, so plain English works), re-evaluates
// affected messages, and replies to confirm. This is what makes SignalDeck
// learn your preferences over time — all locally.

import { prisma } from "@/server/db/client";
import { getAiProvider, type AiProvider } from "@/server/ai";
import {
  getTelegramOffset,
  setTelegramChatId,
  setTelegramOffset,
} from "@/server/settings";
import {
  getUpdates,
  sendTelegramMessage,
  telegramBotConfigured,
} from "@/server/delivery/telegram";
import { addRule, ruleMatchWhere, type RuleKind } from "./memory";

const PARSE_PROMPT = `You turn a user's message to their assistant into a standing rule, IF it is one.
Reply with ONLY JSON, no prose:
{ "kind": "mute" | "priority" | "note" | "skip", "subject": "the person, sender, domain, or topic it is about (lowercase), or \\"\\"" }

- "mute": they want to STOP seeing messages from/about this.
- "priority": they want messages from/about this treated as MORE important.
- "note": some other genuine standing preference.
- "skip": a greeting, question, small talk, command, or anything that isn't a clear preference. When unsure, use "skip".

CRITICAL — read intent, watch for negations. "Never ignore X", "don't mute X", "stop hiding X" mean KEEP SHOWING X — that is NOT a priority rule and usually NOT a rule at all; use "skip" unless they clearly ask to elevate it. Only choose "mute"/"priority" when the user plainly asks to hide or to elevate.

Examples:
- "hi" -> {"kind":"skip","subject":""}
- "what can you do?" -> {"kind":"skip","subject":""}
- "mute newsletters from substack" -> {"kind":"mute","subject":"substack"}
- "ignore recruiters" -> {"kind":"mute","subject":"recruiters"}
- "Cameron is always urgent" -> {"kind":"priority","subject":"cameron"}
- "never ignore anything from recruiters" -> {"kind":"skip","subject":""}
- "don't mute my boss" -> {"kind":"skip","subject":""}`;

type ParseKind = RuleKind | "skip";
interface ParsedRule {
  kind: ParseKind;
  subject: string;
}

const KINDS: ParseKind[] = ["mute", "priority", "note", "skip"];

async function parseInstruction(
  provider: AiProvider,
  text: string,
): Promise<ParsedRule> {
  try {
    const res = await provider.generate({
      system: PARSE_PROMPT,
      messages: [{ role: "user", content: text }],
      maxTokens: 120,
    });
    const cleaned = res.text.replace(/<think>[\s\S]*?<\/think>/gi, "");
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      const kind = String(obj.kind ?? "skip").toLowerCase() as ParseKind;
      const subject = String(obj.subject ?? "").toLowerCase().trim();
      // A mute/priority rule with no subject can't match anything — skip it.
      if ((kind === "mute" || kind === "priority") && !subject) {
        return { kind: "skip", subject: "" };
      }
      return { kind: KINDS.includes(kind) ? kind : "skip", subject };
    }
  } catch {
    // fall through
  }
  return { kind: "skip", subject: "" };
}

const HELP =
  "👋 I'm SignalDeck. I deliver your daily brief here, and I learn your " +
  "preferences. Tell me things like:\n" +
  "• <i>mute newsletters from substack</i>\n" +
  "• <i>Cameron is always high priority</i>\n" +
  "• <i>ignore anything from recruiters</i>";

/** Re-evaluate already-classified messages a rule touches, so it takes
 *  effect on the next classification tick. */
async function reclassifyMatching(userId: string, subject: string): Promise<void> {
  if (!subject) return;
  await prisma.messageInsight.deleteMany({
    where: { message: { account: { userId }, OR: ruleMatchWhere(subject) } },
  });
}

// Escape for Telegram HTML parse_mode (subject comes from model output).
function tgEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function confirmText(rule: ParsedRule): string {
  const subject = tgEsc(rule.subject);
  switch (rule.kind) {
    case "mute":
      return `🔕 Muted: <b>${subject}</b>. I'll keep those out of your brief.`;
    case "priority":
      return `⭐ Got it — <b>${subject}</b> is now high priority.`;
    default:
      return `✓ Noted. I'll keep that in mind.`;
  }
}

/**
 * Process inbound Telegram messages into rules. Returns true when the bot is
 * configured (so the caller's long-poll loop keeps running) and false when
 * it isn't (so the loop can back off). `longPollSeconds` blocks the fetch
 * until a message arrives, giving near-instant replies.
 */
export async function processInboundTelegram(
  opts: { longPollSeconds?: number } = {},
): Promise<boolean> {
  if (!(await telegramBotConfigured())) return false;

  const offset = await getTelegramOffset();
  const updates = await getUpdates(
    offset ? offset + 1 : undefined,
    opts.longPollSeconds ?? 0,
  );
  if (updates.length === 0) return true;

  const user = await prisma.user.findFirst();
  if (!user) return true;
  const provider = await getAiProvider();
  let maxId = offset;

  for (const update of updates) {
    maxId = Math.max(maxId, update.updateId);
    await setTelegramChatId(update.chatId); // also learns the delivery target
    const text = update.text.trim();
    try {
      // Bot commands and greetings are not rules.
      if (text.startsWith("/")) {
        await sendTelegramMessage(update.chatId, HELP);
        continue;
      }
      const rule = await parseInstruction(provider, text);
      if (rule.kind === "skip") {
        await sendTelegramMessage(update.chatId, HELP);
        continue;
      }
      await addRule(user.id, { text, kind: rule.kind, subject: rule.subject });
      await reclassifyMatching(user.id, rule.subject);
      await sendTelegramMessage(update.chatId, confirmText(rule));
      console.log(`[worker] learned rule (${rule.kind}: ${rule.subject})`);
    } catch (error) {
      console.error("[worker] failed to process telegram message", error);
    }
  }

  await setTelegramOffset(maxId);
  return true;
}
