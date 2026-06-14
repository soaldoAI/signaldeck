import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/server/auth";
import { exchangeCode, fetchUserEmail } from "@/server/connectors/google/oauth";
import { upsertGoogleAccount } from "@/server/connectors/accounts";
import { syncGmailAccount } from "@/server/connectors/gmail/sync";
import { syncCalendarAccount } from "@/server/connectors/calendar/sync";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";
const CONNECTOR_COOKIE = "google_oauth_connector";

// Handles Google's redirect back: verifies state, exchanges the code for
// tokens, stores the connected account (tokens encrypted), and runs an
// immediate first sync so the user sees results right away.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const home = (status: string) => {
    const res = NextResponse.redirect(new URL(`/?connect=${status}`, origin));
    // Clear the one-time OAuth cookies on the way out.
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    res.cookies.set(CONNECTOR_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  };

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const params = request.nextUrl.searchParams;
  // Read straight off the request — the same cookies() quirk that breaks
  // setting also makes reading via the helper unreliable across the redirect.
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  const connector = request.cookies.get(CONNECTOR_COOKIE)?.value ?? "gmail";

  if (params.get("error")) return home("denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || state !== expectedState) {
    console.error(
      `[connect] state check failed (hasCode=${Boolean(code)} hasState=${Boolean(
        state,
      )} hasCookie=${Boolean(expectedState)} match=${state === expectedState})`,
    );
    return home("failed");
  }

  try {
    const tokens = await exchangeCode(code);
    const email = await fetchUserEmail(tokens.accessToken);
    const account = await upsertGoogleAccount({
      userId: user.id,
      connectorId: connector,
      externalId: email,
      label: email,
      tokens,
    });

    // Immediate first sync — best effort; ongoing sync is the worker's job.
    const sync =
      connector === "google_calendar" ? syncCalendarAccount : syncGmailAccount;
    await sync(account).catch((error) => {
      console.error(`[connect] initial ${connector} sync failed`, error);
    });

    return home(connector === "google_calendar" ? "calendar" : "gmail");
  } catch (error) {
    console.error("[connect] google callback failed", error);
    return home("failed");
  }
}
