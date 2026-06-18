import { requireUser } from "@/server/auth";
import { getConnectorHealthForUser } from "@/server/connectors/registry";
import { getBrief, type BriefItem } from "@/server/intelligence/brief";
import { getTimezone } from "@/server/settings";
import { StatusDot } from "@/app/_components/status-dot";
import { logout } from "@/app/login/actions";
import { telegramBotConfigured } from "@/server/delivery/telegram";
import {
  sendTestBriefing,
  sendTestBriefingTelegram,
} from "@/app/_actions/briefing";

export const dynamic = "force-dynamic";

const CONNECT_BANNER: Record<string, { tone: "ok" | "err"; text: string }> = {
  gmail: { tone: "ok", text: "Gmail connected. Your inbox is syncing." },
  calendar: { tone: "ok", text: "Google Calendar connected. Your schedule is syncing." },
  denied: { tone: "err", text: "Connection cancelled." },
  failed: { tone: "err", text: "Couldn't connect — please try again." },
  unconfigured: {
    tone: "err",
    text: "Google isn't configured yet (see docs/google-oauth-setup.md).",
  },
  sent: { tone: "ok", text: "Test briefing sent — check your inbox." },
  "briefing-failed": {
    tone: "err",
    text: "Couldn't send the briefing — check SMTP settings.",
  },
  "tg-sent": { tone: "ok", text: "Brief sent to Telegram." },
  "tg-failed": {
    tone: "err",
    text: "Couldn't send to Telegram — set TELEGRAM_BOT_TOKEN and message your bot once (docs/telegram-setup.md).",
  },
};

const BRIEFING_BANNER_KEY: Record<string, string> = {
  failed: "briefing-failed",
  "tg-sent": "tg-sent",
  "tg-failed": "tg-failed",
};

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string; briefing?: string }>;
}) {
  const user = await requireUser();
  const [connectors, brief, timezone] = await Promise.all([
    getConnectorHealthForUser(user.id),
    getBrief(user.id),
    getTimezone(),
  ]);
  const sp = await searchParams;
  const briefingKey = sp.briefing
    ? (BRIEFING_BANNER_KEY[sp.briefing] ?? sp.briefing)
    : undefined;
  const banner = CONNECT_BANNER[sp.connect ?? briefingKey ?? ""];
  const analysing = brief.totalMessages - brief.classifiedCount;
  const tgEnabled = await telegramBotConfigured();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-10 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">SignalDeck</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <form action={logout}>
          <button className="text-sm text-muted underline-offset-4 hover:underline">
            Sign out
          </button>
        </form>
      </header>

      {banner && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            banner.tone === "ok"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {banner.text}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Today&apos;s brief
          </h2>
          <div className="flex items-center gap-3">
            {analysing > 0 && (
              <span className="text-xs text-muted">Analysing {analysing}…</span>
            )}
            {brief.classifiedCount > 0 && (
              <form action={sendTestBriefing}>
                <button className="text-xs text-accent underline-offset-4 hover:underline">
                  Email me this brief
                </button>
              </form>
            )}
            {brief.classifiedCount > 0 && tgEnabled && (
              <form action={sendTestBriefingTelegram}>
                <button className="text-xs text-accent underline-offset-4 hover:underline">
                  Send to Telegram
                </button>
              </form>
            )}
          </div>
        </div>

        {brief.totalMessages === 0 ? (
          <EmptyBrief />
        ) : brief.classifiedCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-base font-medium">Reading your inbox…</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              {brief.totalMessages} messages synced. SignalDeck is working
              through them — your brief appears here shortly.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <BriefList title="Priority — needs you now" dot="#dc2626" items={brief.high} cap={10} />
            <BriefList title="When you can" dot="#d97706" items={brief.medium} cap={8} />
            <BriefList title="Can wait" dot="#a8a29e" items={brief.low} cap={5} />
            <BriefList title="Waiting on others" dot="#a8a29e" items={brief.waiting} cap={5} />
            {brief.high.length + brief.medium.length + brief.low.length + brief.waiting.length === 0 && (
              <p className="text-sm text-muted">Nothing needs you right now. 🎉</p>
            )}
            <p className="text-xs text-muted">
              {brief.ignorableCount} message
              {brief.ignorableCount === 1 ? "" : "s"} you can ignore (newsletters,
              notifications).
            </p>
          </div>
        )}
      </section>

      {brief.events.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
            Coming up
          </h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {brief.events.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{e.title}</p>
                  {e.location && (
                    <p className="truncate text-xs text-muted">{e.location}</p>
                  )}
                </div>
                <span className="ml-auto whitespace-nowrap text-xs text-muted">
                  {formatEventTime(e.startsAt, e.allDay, timezone)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Channels
        </h2>
        <ul className="flex flex-col gap-2">
          {connectors.map(({ descriptor, status, detail, label }, idx) => {
            const connected = status !== "not_connected";
            return (
              <li
                key={`${descriptor.id}-${label ?? idx}`}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <span className="text-lg" aria-hidden>
                  {descriptor.icon}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {descriptor.name}
                    {descriptor.edition === "pro" && (
                      <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted dark:bg-stone-800">
                        Pro
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {label ?? descriptor.description}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="flex items-center gap-1.5 text-xs text-muted">
                    <StatusDot status={status} />
                    {detail}
                  </span>
                  {descriptor.available ? (
                    <a
                      href={
                        descriptor.id === "telegram"
                          ? "/connect/telegram"
                          : `/api/connectors/google/connect?connector=${descriptor.id}`
                      }
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:border-accent"
                    >
                      {connected ? "Reconnect" : "Connect"}
                    </a>
                  ) : (
                    <button
                      disabled
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted disabled:cursor-not-allowed"
                      title="Available in an upcoming release"
                    >
                      Connect
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

// One priority tier: a coloured-dot heading with a count, the items (each
// linking to its source message), and a "+N more" line when capped.
function BriefList({
  title,
  dot,
  items,
  cap = Infinity,
}: {
  title: string;
  dot: string;
  items: BriefItem[];
  cap?: number;
}) {
  if (items.length === 0) return null;
  const shown = items.slice(0, cap);
  return (
    <div className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />
        {title}
        <span className="text-muted/70">({items.length})</span>
      </h3>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {shown.map((i) => (
          <li key={i.id}>
            <ItemLink url={i.url}>
              <p className="text-sm font-medium">{i.action || i.subject}</p>
              <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                <SourceBadge source={i.source} />
                <span className="truncate">
                  {i.from}
                  <span className="text-muted/70"> · {i.account}</span>
                </span>
              </p>
            </ItemLink>
          </li>
        ))}
        {items.length > cap && (
          <li className="px-4 py-2 text-xs text-muted">
            …and {items.length - cap} more
          </li>
        )}
      </ul>
    </div>
  );
}

// A small coloured pill identifying the channel a brief item came from.
function SourceBadge({ source }: { source: BriefItem["source"] }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
      style={{ background: source.color }}
    >
      {source.icon} {source.name}
    </span>
  );
}

// Wraps a brief row in a link to the source message when one exists, so a
// click jumps straight to the email; otherwise renders a plain row.
function ItemLink({ url, children }: { url: string; children: React.ReactNode }) {
  if (!url) return <div className="px-4 py-3">{children}</div>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-4 py-3 transition hover:bg-border/40"
    >
      {children}
    </a>
  );
}

function EmptyBrief() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <p className="text-base font-medium">No brief yet</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
        Connect your first account below and SignalDeck will tell you what
        needs your attention today.
      </p>
    </div>
  );
}

function formatEventTime(date: Date, allDay: boolean, timezone: string): string {
  if (allDay) {
    return date.toLocaleDateString([], { timeZone: timezone, month: "short", day: "numeric" });
  }
  return date.toLocaleString([], {
    timeZone: timezone,
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
