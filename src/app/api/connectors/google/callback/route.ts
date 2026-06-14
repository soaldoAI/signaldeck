import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
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
  const home = (status: string) =>
    NextResponse.redirect(new URL(`/?connect=${status}`, origin));

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const params = request.nextUrl.searchParams;
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const connector = cookieStore.get(CONNECTOR_COOKIE)?.value ?? "gmail";
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(CONNECTOR_COOKIE);

  if (params.get("error")) return home("denied");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !expectedState || state !== expectedState) {
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
