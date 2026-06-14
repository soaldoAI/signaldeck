import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth";
import {
  buildAuthUrl,
  isGoogleConfigured,
  scopesForConnector,
} from "@/server/connectors/google/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";
const CONNECTOR_COOKIE = "google_oauth_connector";
const SUPPORTED = new Set(["gmail", "google_calendar"]);

// Starts the Google consent flow for a given connector. A random `state`
// (CSRF) and the target connector are stored in httpOnly cookies and read
// back on the callback.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/?connect=unconfigured", origin));
  }

  const connector = request.nextUrl.searchParams.get("connector") ?? "gmail";
  if (!SUPPORTED.has(connector)) {
    return NextResponse.redirect(new URL("/?connect=failed", origin));
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(
    buildAuthUrl({ state, scopes: scopesForConnector(connector) }),
  );
  const secure = (process.env.APP_URL ?? "").startsWith("https://");
  const cookieOpts = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 600,
  };
  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOpts);
  store.set(CONNECTOR_COOKIE, connector, cookieOpts);
  return response;
}
