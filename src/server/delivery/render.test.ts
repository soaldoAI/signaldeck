import { describe, expect, it } from "vitest";
import { renderBriefing, renderBriefingTelegram } from "./render";
import type { Brief, BriefItem } from "@/server/intelligence/brief";

function item(over: Partial<BriefItem> = {}): BriefItem {
  return {
    id: "1",
    subject: "Re: contract",
    from: "Sarah",
    summary: "awaiting your sign-off",
    action: "Sign the contract",
    category: "needs_reply",
    priority: "high",
    source: { name: "Gmail", icon: "✉️", color: "#ea4335" },
    account: "me@work.com",
    url: "https://mail.google.com/x",
    ...over,
  };
}

const baseBrief: Brief = {
  high: [item()],
  medium: [
    item({
      id: "2",
      action: "Reply to Joe",
      source: { name: "Telegram", icon: "✈️", color: "#0088cc" },
    }),
  ],
  low: [],
  waiting: [],
  events: [
    {
      id: "e1",
      title: "Standup",
      location: "Zoom",
      startsAt: new Date("2026-06-15T23:00:00Z"), // 09:00 Sydney
      allDay: false,
    },
  ],
  totalMessages: 10,
  classifiedCount: 10,
  ignorableCount: 8,
};

describe("renderBriefing", () => {
  it("produces a subject, text, and html with priority tiers", () => {
    const r = renderBriefing(baseBrief, "Australia/Sydney");
    expect(r.subject).toMatch(/Your SignalDeck brief/);
    expect(r.text).toContain("PRIORITY — NEEDS YOU NOW");
    expect(r.text).toContain("Sign the contract");
    expect(r.html).toContain("Sign the contract");
  });

  it("labels each item with its source", () => {
    const r = renderBriefing(baseBrief, "UTC");
    expect(r.text).toContain("Gmail");
    expect(r.text).toContain("Telegram");
  });

  it("renders event times in the given timezone", () => {
    const r = renderBriefing(baseBrief, "Australia/Sydney");
    expect(r.text).toMatch(/09:00/);
  });

  it("caps a long tier and shows a 'more' line", () => {
    const many = Array.from({ length: 20 }, (_, n) => item({ id: `m${n}`, priority: "medium" }));
    const r = renderBriefing({ ...baseBrief, medium: many }, "UTC");
    expect(r.text).toMatch(/…and \d+ more/);
  });

  it("escapes HTML in subjects to prevent injection", () => {
    const r = renderBriefing(
      { ...baseBrief, high: [item({ action: "<script>x</script>" })] },
      "UTC",
    );
    expect(r.html).not.toContain("<script>x</script>");
    expect(r.html).toContain("&lt;script&gt;");
  });
});

describe("renderBriefingTelegram", () => {
  it("produces Telegram-HTML with bold headers and bullets", () => {
    const s = renderBriefingTelegram(baseBrief, "Australia/Sydney");
    expect(s).toContain("<b>🔴 Priority — needs you now (1)</b>");
    expect(s).toContain("• Sign the contract");
    expect(s.length).toBeLessThanOrEqual(4096);
  });

  it("escapes HTML in dynamic content", () => {
    const s = renderBriefingTelegram(
      { ...baseBrief, high: [item({ action: "<b>x</b>" })] },
      "UTC",
    );
    expect(s).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});
