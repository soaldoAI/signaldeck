// Brief assembly: turns classified messages + upcoming events into the
// structured "what matters today" view the dashboard (and, in Phase 9, the
// briefing email) render. Pure data shaping over the DB — no AI here; the
// thinking already happened in classify.ts.

import { prisma } from "@/server/db/client";
import type { Category } from "./classify";

export interface BriefItem {
  id: string;
  subject: string;
  from: string;
  summary: string;
  action: string;
  category: Category;
}

export interface BriefEvent {
  id: string;
  title: string;
  location: string;
  startsAt: Date;
  allDay: boolean;
}

export interface Brief {
  needsReply: BriefItem[];
  urgent: BriefItem[];
  waiting: BriefItem[];
  /** Every concrete to-do extracted across all messages. */
  actions: BriefItem[];
  events: BriefEvent[];
  totalMessages: number;
  classifiedCount: number;
  ignorableCount: number;
}

/** Build the brief for a user from their classified messages and events. */
export async function getBrief(userId: string): Promise<Brief> {
  const where = { account: { userId } };

  const [messages, totalMessages, classifiedCount, events] = await Promise.all([
    prisma.message.findMany({
      where: { ...where, insight: { isNot: null } },
      include: { insight: true },
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

  const toItem = (m: (typeof messages)[number]): BriefItem => ({
    id: m.id,
    subject: m.subject || "(no subject)",
    from: m.fromName || m.fromEmail,
    summary: m.insight?.summary ?? "",
    action: m.insight?.action ?? "",
    category: (m.insight?.category ?? "fyi") as Category,
  });

  const items = messages.map(toItem);
  const byCategory = (c: Category) => items.filter((i) => i.category === c);

  return {
    needsReply: byCategory("needs_reply"),
    urgent: byCategory("urgent"),
    waiting: byCategory("waiting"),
    actions: items.filter((i) => i.action.trim().length > 0),
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
      (i) => i.category === "fyi" || i.category === "ignore",
    ).length,
  };
}
