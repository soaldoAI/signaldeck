// Renders a Brief into an email (subject + plain text + HTML) and a Telegram
// message. Organised by priority, source-labelled, and capped so it stays a
// calm summary rather than a 60-item dump. Pure + timezone-aware.

import type { Brief, BriefItem, BriefEvent } from "@/server/intelligence/brief";

export interface RenderedBriefing {
  subject: string;
  text: string;
  html: string;
}

// Caps keep the brief calm — show the top of each tier, summarise the rest.
const HIGH_CAP = 10;
const MEDIUM_CAP = 6;
const LOW_CAP = 4;
const WAITING_CAP = 4;

function primary(i: BriefItem): string {
  return i.action || i.subject;
}
function secondary(i: BriefItem): string {
  return `${i.from} · ${i.source.icon} ${i.source.name}`;
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

export function renderBriefing(brief: Brief, timezone: string): RenderedBriefing {
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return {
    subject: `Your SignalDeck brief — ${today}`,
    text: renderText(brief, timezone, today),
    html: renderHtml(brief, timezone, today),
  };
}

// --- Plain text -----------------------------------------------------------

function renderText(brief: Brief, tz: string, today: string): string {
  const lines: string[] = [`SignalDeck — ${today}`, ""];

  textGroup(lines, "🔴 PRIORITY — NEEDS YOU NOW", brief.high, HIGH_CAP);
  textGroup(lines, "🟡 WHEN YOU CAN", brief.medium, MEDIUM_CAP);
  textGroup(lines, "⚪ CAN WAIT", brief.low, LOW_CAP);
  textGroup(lines, "WAITING ON OTHERS", brief.waiting, WAITING_CAP);

  if (brief.events.length) {
    lines.push("TODAY & COMING UP");
    for (const e of brief.events) lines.push(`  • ${eventTime(e, tz)} — ${e.title}`);
    lines.push("");
  }
  lines.push(
    `${brief.ignorableCount} message${brief.ignorableCount === 1 ? "" : "s"} you can ignore.`,
  );
  return lines.join("\n");
}

function textGroup(
  lines: string[],
  title: string,
  items: BriefItem[],
  cap = Infinity,
): void {
  if (!items.length) return;
  lines.push(`${title} (${items.length})`);
  for (const i of items.slice(0, cap)) {
    lines.push(`  • ${primary(i)}  (${secondary(i)})`);
  }
  if (items.length > cap) lines.push(`  …and ${items.length - cap} more`);
  lines.push("");
}

// --- Telegram (HTML subset: <b>, <i>) -------------------------------------

function tg(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderBriefingTelegram(brief: Brief, timezone: string): string {
  const today = new Date().toLocaleDateString("en-GB", {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const blocks: string[] = [`<b>SignalDeck — ${tg(today)}</b>`];

  tgGroup(blocks, "🔴 Priority — needs you now", brief.high, HIGH_CAP);
  tgGroup(blocks, "🟡 When you can", brief.medium, MEDIUM_CAP);
  tgGroup(blocks, "⚪ Can wait", brief.low, LOW_CAP);
  tgGroup(blocks, "Waiting on others", brief.waiting, WAITING_CAP);

  if (brief.events.length) {
    blocks.push(
      `<b>Today &amp; coming up</b>\n` +
        brief.events.map((e) => `• ${tg(eventTime(e, timezone))} — ${tg(e.title)}`).join("\n"),
    );
  }
  blocks.push(`<i>${brief.ignorableCount} you can ignore.</i>`);
  return blocks.join("\n\n");
}

function tgGroup(
  blocks: string[],
  title: string,
  items: BriefItem[],
  cap = Infinity,
): void {
  if (!items.length) return;
  const rows = items
    .slice(0, cap)
    .map((i) => `• ${tg(primary(i))} <i>(${tg(secondary(i))})</i>`);
  if (items.length > cap) rows.push(`<i>…and ${items.length - cap} more</i>`);
  blocks.push(`<b>${tg(title)} (${items.length})</b>\n${rows.join("\n")}`);
}

// --- HTML email -----------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function htmlRow(i: BriefItem): string {
  const link = i.url
    ? ` <a href="${esc(i.url)}" style="color:#0f766e;font-size:12px">open →</a>`
    : "";
  return `<strong>${esc(primary(i))}</strong>${link}<br><span style="color:#78716c">${esc(secondary(i))}</span>`;
}

function htmlGroup(
  title: string,
  items: BriefItem[],
  color: string,
  cap = Infinity,
): string {
  if (!items.length) return "";
  const rows = items
    .slice(0, cap)
    .map(
      (r) =>
        `<li style="padding:10px 14px;border-bottom:1px solid #e7e5e4;font-size:14px;line-height:1.4">${htmlRow(r)}</li>`,
    );
  if (items.length > cap) {
    rows.push(
      `<li style="padding:8px 14px;font-size:12px;color:#a8a29e">…and ${items.length - cap} more</li>`,
    );
  }
  return `<h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:${color};margin:18px 0 6px">${esc(title)} (${items.length})</h2>
  <ul style="list-style:none;margin:0;padding:0;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">${rows.join("")}</ul>`;
}

function renderHtml(brief: Brief, tz: string, today: string): string {
  const sections = [
    htmlGroup("Priority — needs you now", brief.high, "#dc2626", HIGH_CAP),
    htmlGroup("When you can", brief.medium, "#d97706", MEDIUM_CAP),
    htmlGroup("Can wait", brief.low, "#78716c", LOW_CAP),
    htmlGroup("Waiting on others", brief.waiting, "#78716c", WAITING_CAP),
  ];

  if (brief.events.length) {
    const evs = brief.events
      .map(
        (e) =>
          `<li style="padding:10px 14px;border-bottom:1px solid #e7e5e4;font-size:14px"><strong>${esc(eventTime(e, tz))}</strong> — ${esc(e.title)}</li>`,
      )
      .join("");
    sections.push(
      `<h2 style="font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#78716c;margin:18px 0 6px">Today &amp; coming up</h2><ul style="list-style:none;margin:0;padding:0;background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">${evs}</ul>`,
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
