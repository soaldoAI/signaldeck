import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser } from "@/server/auth";
import { buildAuthUrl, isGoogleConfigured } from "@/server/connectors/google/oauth";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "google_oauth_state";

// Starts the Google consent flow. A random `state` is stored in an httpOnly
// cookie and echoed back on the callback to defend against CSRF.
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.nextUrl.origin;
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/?connect=unconfigured", origin));
  }

  const state = randomBytes(16).toString("hex");
  const response = NextResponse.redirect(buildAuthUrl({ state }));
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
  return response;
}
