import { redirect } from "next/navigation";
import { isSetupComplete } from "@/server/auth";
import { getConnectorCatalogue } from "@/server/connectors/registry";
import { getSmtpConfig } from "@/server/settings";
import { SetupForm } from "./setup-form";

// Reads instance state from the database on every request; never
// prerender (the build has no database).
export const dynamic = "force-dynamic";

// First-run wizard. Available only until the admin account exists; after
// that, setup is closed and visitors are sent to login.
export default async function SetupPage() {
  if (await isSetupComplete()) redirect("/login");

  // SMTP defaults come from the environment so the bundled mail server
  // pre-fills correctly whether running on the host (localhost) or in
  // Docker (the `mailpit` service).
  const smtp = await getSmtpConfig();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome to SignalDeck
        </h1>
        <p className="text-muted">
          A few minutes now and your AI Chief of Staff is ready. Everything
          stays on your own machine.
        </p>
      </header>
      <SetupForm
        connectors={getConnectorCatalogue()}
        smtpDefaults={{
          host: smtp.host,
          port: smtp.port,
          from: smtp.from,
        }}
      />
    </main>
  );
}
