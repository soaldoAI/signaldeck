import { describe, expect, it } from "vitest";
import { renderBriefing } from "./render";
import type { Brief, BriefItem } from "@/server/intelligence/brief";

function item(over: Partial<BriefItem> = {}): BriefItem {
  return {
    id: "1",
    subject: "Re: contract",
    from: "Sarah",
    summary: "awaiting your sign-off",
    action: "",
    category: "needs_reply",
    url: "https://mail.google.com/x",
    ...over,
  };
}

const baseBrief: Brief = {
  needsReply: [item()],
  urgent: [],
  waiting: [],
  actions: [item({ action: "Sign the contract" })],
  events: [
    {
      id: "e1",
      title: "Standup",
      location: "Zoom",
      startsAt: new Date("2026-06-15T23:00:00Z"), // 09:00 Sydney (UTC+10)
      allDay: false,
    },
  ],
  totalMessages: 10,
  classifiedCount: 10,
  ignorableCount: 8,
};

describe("renderBriefing", () => {
  it("produces a subject, text, and html", () => {
    const r = renderBriefing(baseBrief, "Australia/Sydney");
    expect(r.subject).toMatch(/Your SignalDeck brief/);
    expect(r.text).toContain("WHAT NEEDS YOU");
    expect(r.text).toContain("Sign the contract");
    expect(r.html).toContain("<html");
    expect(r.html).toContain("Sign the contract");
  });

  it("renders event times in the given timezone", () => {
    const r = renderBriefing(baseBrief, "Australia/Sydney");
    // 23:00 UTC is 09:00 the next day in Sydney
    expect(r.text).toMatch(/09:00/);
  });

  it("escapes HTML in subjects to prevent injection", () => {
    const r = renderBriefing(
      { ...baseBrief, needsReply: [item({ subject: "<script>x</script>" })] },
      "UTC",
    );
    expect(r.html).not.toContain("<script>x</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });

  it("includes the ignorable count", () => {
    const r = renderBriefing(baseBrief, "UTC");
    expect(r.text).toContain("8 messages you can ignore");
  });
});
