import { redirect } from "next/navigation";
import { getSessionUser, isSetupComplete } from "@/server/auth";
import { LoginForm } from "./login-form";

// Depends on per-request session/instance state; never prerender.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Send first-time visitors to setup, and already-signed-in users home.
  if (!(await isSetupComplete())) redirect("/setup");
  if (await getSessionUser()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">SignalDeck</h1>
        <p className="text-sm text-muted">Sign in to your operations centre.</p>
      </header>
      <LoginForm />
    </main>
  );
}
