// Renders a Brief into an email (subject + plain text + HTML). Pure and
// timezone-aware so it's unit-testable; no DB or network here.

import type { Brief, BriefItem, BriefEvent } from "@/server/intelligence/brief";

export interface RenderedBriefing {
  subject: string;
  text: string;
  html: string;
}

export function renderBriefing(brief: Brief, timezone: string): RenderedBriefing {
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const subject = `Your SignalDeck brief — ${today}`;
  return {
    subject,
    text: renderText(brief, timezone, today),
    html: renderHtml(brief, timezone, today),
  };
}

function eventTime(e: BriefEvent, tz: string): string {
  if (e.allDay) {
    return e.startsAt.toLocaleDateString("en-GB", {
      timeZone: tz,
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }
  return e.startsAt.toLocaleString("en-GB", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// --- Plain text -----------------------------------------------------------

function renderText(brief: Brief, tz: string, today: string): string {
  const lines: string[] = [`SignalDeck — ${today}`, ""];

  if (brief.actions.length) {
    lines.push("WHAT NEEDS YOU");
    for (const i of brief.actions) lines.push(`  • ${i.action}  (${i.from})`);
    lines.push("");
  }
  pushTextGroup(lines, "NEEDS YOUR REPLY", brief.needsReply);
  pushTextGroup(lines, "URGENT", brief.urgent);
  pushTextGroup(lines, "WAITING ON OTHERS", brief.waiting);

  if (brief.events.length) {
    lines.push("TODAY & COMING UP");
    for (const e of brief.events) {
      lines.push(`  • ${eventTime(e, tz)} — ${e.title}`);
    }
    lines.push("");
  }

  lines.push(
    `${brief.ignorableCount} message${brief.ignorableCount === 1 ? "" : "s"} you can ignore.`,
  );
  return lines.join("\n");
}

function pushTextGroup(lines: string[], title: string, items: BriefItem[]): void {
  if (!items.length) return;
  lines.push(`${title} (${items.length})`);
  for (const i of items) {
    lines.push(`  • ${i.subject} — ${i.from}${i.summary ? ` — ${i.summary}` : ""}`);
  }
  lines.push("");
}

// --- HTML -----------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHtml(brief: Brief, tz: string, today: string): string {
  const sections: string[] = [];

  if (brief.actions.length) {
    sections.push(
      htmlGroup(
        "What needs you",
        brief.actions.map(
          (i) =>
            `<strong>${esc(i.action)}</strong><br><span style="color:#78716c">${esc(i.from)} · ${esc(i.subject)}</span>${link(i)}`,
        ),
        "#0f766e",
      ),
    );
  }
  sections.push(htmlItemGroup("Needs your reply", brief.needsReply));
  sections.push(htmlItemGroup("Urgent", brief.urgent));
  sections.push(htmlItemGroup("Waiting on others", brief.waiting));

  if (brief.events.length) {
    sections.push(
      htmlGroup(
        "Today & coming up",
        brief.events.map(
          (e) =>
            `<strong>${esc(eventTime(e, tz))}</strong> — ${esc(e.title)}${e.location ? `<br><span style="color:#78716c">${esc(e.location)}</span>` : ""}`,
        ),
      ),
    );
  }

  return `<!doctype html><html><body style="margin:0;background:#fafaf9;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917">
  <div style="max-width:560px;margin:0 auto;padding:24px">
    <h1 style="font-size:18px;margin:0 0 2px">SignalDeck</h1>
    <p style="margin:0 0 20px;color:#78716c;font-size:13px">${esc(today)}</p>
    ${sections.filter(Boolean).join("\n")}
    <p style="color:#a8a29e;font-size:12px;margin-top:24px">${brief.ignorableCount} message${brief.ignorableCount === 1 ? "" : "s"} you can ignore (newsletters, notifications).</p>
  </div></body></html>`;
}

function link(i: BriefItem): string {
  return i.url
    ? ` <a href="${esc(i.url)}" style="color:#0f766e;font-size:12px">open →</a>`
    : "";
}

function htmlItemGroup(title: string, items: BriefItem[]): string {
  if (!items.length) return "";
  return htmlGroup(
    title,
    items.map(
      (i) =>
        `<strong>${esc(i.subject)}</strong>${link(i)}<br><span style="color:#78716c">${esc(i.from)}${i.summary ? ` · ${esc(i.summary)}` : ""}</span>`,
    ),
  );
}

function htmlGroup(title: string, rows: string[], color = "#78716c"): string {
  const lis = rows
    .map(
      (r) =>
        `<li style="padding:10px 14px;border-bottom:1px solid #e7e5e4;font-size:14px;line-height:1.4">${r}</li>`,
    )
    .join("");
  return `<h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${color};margin:18px 0 6px">${esc(title)}</h2>
  <ul style="list-style:none;margin:0;padding:0;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">${lis}</ul>`;
}
