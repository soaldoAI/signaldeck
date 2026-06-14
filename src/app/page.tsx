import { requireUser } from "@/server/auth";
import { getConnectorHealthForUser } from "@/server/connectors/registry";
import { prisma } from "@/server/db/client";
import { StatusDot } from "@/app/_components/status-dot";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

const CONNECT_BANNER: Record<string, { tone: "ok" | "err"; text: string }> = {
  gmail: { tone: "ok", text: "Gmail connected. Your inbox is syncing." },
  denied: { tone: "err", text: "Connection cancelled." },
  failed: { tone: "err", text: "Couldn't connect — please try again." },
  unconfigured: {
    tone: "err",
    text: "Google isn't configured yet (see docs/google-oauth-setup.md).",
  },
};

// The operations centre home. The briefing itself arrives in Phase 9; for
// now the dashboard shows connection health and recent synced activity —
// proof the pipeline is alive end to end.
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ connect?: string }>;
}) {
  const user = await requireUser();
  const connectors = await getConnectorHealthForUser(user.id);
  const banner = CONNECT_BANNER[(await searchParams).connect ?? ""];

  const recent = await prisma.message.findMany({
    where: { account: { userId: user.id } },
    orderBy: { receivedAt: "desc" },
    take: 8,
  });
  const messageCount = await prisma.message.count({
    where: { account: { userId: user.id } },
  });

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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Today&apos;s brief
        </h2>
        {messageCount === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
            <p className="text-base font-medium">No brief yet</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
              Connect your first account below and SignalDeck will tell you
              what needs your attention today.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted">
              {messageCount} message{messageCount === 1 ? "" : "s"} synced.
              Prioritisation arrives in a later update — here&apos;s the latest:
            </p>
            <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {recent.map((m) => (
                <li key={m.id} className="flex flex-col gap-0.5 px-4 py-3">
                  <p className="truncate text-sm font-medium">
                    {m.subject || "(no subject)"}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {m.fromName || m.fromEmail} ·{" "}
                    {m.receivedAt.toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Channels
        </h2>
        <ul className="flex flex-col gap-2">
          {connectors.map(({ descriptor, status, detail, label }) => {
            const connected = status !== "not_connected";
            return (
              <li
                key={descriptor.id}
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
                      href="/api/connectors/google/connect"
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
