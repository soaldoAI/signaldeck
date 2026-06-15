import Link from "next/link";
import { requireUser } from "@/server/auth";

export const dynamic = "force-dynamic";

// Telegram has no OAuth redirect — connecting is a one-time terminal login.
// This page explains the two steps; the heavy lifting is `npm run
// telegram:login`, which keeps gramjs out of the web app.
export default async function ConnectTelegram() {
  await requireUser();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Connect Telegram</h1>
        <p className="text-muted">
          Telegram signs in with your phone and a login code rather than a
          browser approval, so connecting is a one-time command. Your session
          is stored encrypted on your own machine.
        </p>
      </header>

      <ol className="flex flex-col gap-4">
        <Step n={1} title="Get your API credentials">
          At{" "}
          <a
            className="text-accent underline"
            href="https://my.telegram.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            my.telegram.org
          </a>{" "}
          → <em>API development tools</em>, create an app and copy your{" "}
          <code>api_id</code> and <code>api_hash</code>.
        </Step>
        <Step n={2} title="Add them to .env and restart">
          <pre className="mt-1 overflow-x-auto rounded-lg bg-card p-3 text-xs">
            {`TELEGRAM_API_ID="1234567"
TELEGRAM_API_HASH="abcdef0123456789abcdef0123456789"

docker compose up -d`}
          </pre>
        </Step>
        <Step n={3} title="Log in once">
          <pre className="mt-1 overflow-x-auto rounded-lg bg-card p-3 text-xs">
            npm run telegram:login
          </pre>
          Follow the prompts (phone, the code Telegram texts you, 2FA if you
          have it). Your Telegram chats then flow into the brief automatically.
        </Step>
      </ol>

      <p className="text-sm text-muted">
        Full details in <code>docs/telegram-setup.md</code>.
      </p>
      <Link href="/" className="text-sm text-accent underline-offset-4 hover:underline">
        ← Back to dashboard
      </Link>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 text-xs text-accent">
          {n}
        </span>
        {title}
      </p>
      <div className="text-sm text-muted">{children}</div>
    </li>
  );
}
