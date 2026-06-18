// Brief assembly: turns classified messages + upcoming events into the
// organised "what matters today" view. Three jobs that make it calm:
//   1. dedupe by thread (one back-and-forth = one item, not five),
//   2. rank by the AI's priority (high / medium / low → "can wait"),
//   3. label each item's source (Gmail, Telegram, …).
// Pure data shaping over the DB — the thinking already happened in classify.

import { prisma } from "@/server/db/client";
import type { Category, Priority } from "./parse";

export interface BriefSource {
  name: string;
  icon: string;
  /** Brand-ish colour for the badge in the UI/email. */
  color: string;
}

export interface BriefItem {
  id: string;
  subject: string;
  from: string;
  summary: string;
  action: string;
  category: Category;
  priority: Priority;
  source: BriefSource;
  /** Which connected account this came from (e.g. the email address). */
  account: string;
  /** Deep link to open the original message, or "". */
  url: string;
}

export interface BriefEvent {
  id: string;
  title: string;
  location: string;
  startsAt: Date;
  allDay: boolean;
}

export interface Brief {
  /** Actionable items, split by how much they need the user. */
  high: BriefItem[];
  medium: BriefItem[];
  low: BriefItem[];
  /** Things the user is waiting on someone else for. */
  waiting: BriefItem[];
  events: BriefEvent[];
  totalMessages: number;
  classifiedCount: number;
  ignorableCount: number;
}

const SOURCES: Record<string, BriefSource> = {
  gmail: { name: "Gmail", icon: "✉️", color: "#ea4335" },
  google_calendar: { name: "Calendar", icon: "📅", color: "#4285f4" },
  telegram: { name: "Telegram", icon: "✈️", color: "#0088cc" },
  slack: { name: "Slack", icon: "💬", color: "#611f69" },
  whatsapp: { name: "WhatsApp", icon: "📲", color: "#25d366" },
};

function sourceFor(connectorId: string): BriefSource {
  return SOURCES[connectorId] ?? { name: connectorId, icon: "•", color: "#78716c" };
}

function messageUrl(
  connectorId: string,
  externalId: string,
  threadId: string | null,
  accountLabel: string,
): string {
  if (connectorId === "gmail") {
    const id = threadId || externalId;
    return `https://mail.google.com/mail/?authuser=${encodeURIComponent(
      accountLabel,
    )}#all/${id}`;
  }
  return "";
}

/** Build the organised brief for a user. */
export async function getBrief(userId: string): Promise<Brief> {
  const where = { account: { userId } };

  const [messages, totalMessages, classifiedCount, events] = await Promise.all([
    prisma.message.findMany({
      where: { ...where, insight: { isNot: null } },
      include: { insight: true, account: true },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.message.count({ where }),
    prisma.message.count({ where: { ...where, insight: { isNot: null } } }),
    prisma.calendarEvent.findMany({
      where: { ...where, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 8,
    }),
  ]);

  // Dedupe by thread: messages are newest-first, so the first one seen for a
  // thread is the latest — collapse the rest of that conversation into it.
  const byThread = new Map<string, (typeof messages)[number]>();
  for (const m of messages) {
    const key = `${m.accountId}:${m.threadId ?? m.id}`;
    if (!byThread.has(key)) byThread.set(key, m);
  }

  // Drop threads the user has marked done (i.e. whose latest message is
  // dismissed). Newer activity un-dismisses them automatically, since the
  // newer message becomes the thread's representative.
  const items: BriefItem[] = [...byThread.values()]
    .filter((m) => !m.dismissedAt)
    .map((m) => ({
    id: m.id,
    subject: m.subject || "(no subject)",
    from: m.fromName || m.fromEmail,
    summary: m.insight?.summary ?? "",
    action: m.insight?.action ?? "",
    category: (m.insight?.category ?? "fyi") as Category,
    priority: (m.insight?.priority ?? "medium") as Priority,
    source: sourceFor(m.connectorId),
    account: m.account.label,
    url: messageUrl(m.connectorId, m.externalId, m.threadId, m.account.label),
  }));

  // Actionable = needs the user to do/answer something.
  const actionable = (i: BriefItem) =>
    i.category === "needs_reply" ||
    i.category === "urgent" ||
    i.action.trim().length > 0;

  const acts = items.filter(actionable);

  return {
    high: acts.filter((i) => i.priority === "high"),
    medium: acts.filter((i) => i.priority === "medium"),
    low: acts.filter((i) => i.priority === "low"),
    waiting: items.filter((i) => i.category === "waiting"),
    events: events.map((e) => ({
      id: e.id,
      title: e.title,
      location: e.location,
      startsAt: e.startsAt,
      allDay: e.allDay,
    })),
    totalMessages,
    classifiedCount,
    ignorableCount: items.filter(
      (i) => !actionable(i) && i.category !== "waiting",
    ).length,
  };
}
