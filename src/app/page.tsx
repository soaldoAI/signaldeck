import { requireUser } from "@/server/auth";
import { getConnectorCatalogue } from "@/server/connectors/registry";
import { StatusDot } from "@/app/_components/status-dot";
import { logout } from "@/app/login/actions";

// The operations centre home. Until a connector is live (Phase 4), the
// briefing shows an empty state guiding the user to connect their first
// account — which is what will produce their first Daily Brief.
export default async function Dashboard() {
  const user = await requireUser();
  const connectors = getConnectorCatalogue();

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

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Today&apos;s brief
        </h2>
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
          <p className="text-base font-medium">No brief yet</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
            Connect your first account below and SignalDeck will tell you
            what needs your attention today.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-muted">
          Channels
        </h2>
        <ul className="flex flex-col gap-2">
          {connectors.map(({ descriptor, status, detail }) => (
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
                  {descriptor.description}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted">
                  <StatusDot status={status} />
                  {detail}
                </span>
                <button
                  disabled
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted disabled:cursor-not-allowed"
                  title="Available in an upcoming release"
                >
                  Connect
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
