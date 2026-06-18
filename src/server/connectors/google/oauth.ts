// Google OAuth 2.0 — authorization-code flow for connecting the user's own
// Google account. No SDK: plain fetch against Google's documented endpoints.
// Shared by the app (connect/callback routes) and the worker (token refresh
// during sync), so this carries no `server-only` or `next/*` import.

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";

// Least-privilege scopes per connector. Each connector requests only what
// it uses; include_granted_scopes merges grants so connecting a second one
// doesn't drop the first.
const EMAIL_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email"];

export const GMAIL_SCOPES = [
  ...EMAIL_SCOPES,
  "https://www.googleapis.com/auth/gmail.readonly",
];

export const CALENDAR_SCOPES = [
  ...EMAIL_SCOPES,
  "https://www.googleapis.com/auth/calendar.readonly",
];

/** Scopes for a given connector id. */
export function scopesForConnector(connectorId: string): string[] {
  switch (connectorId) {
    case "gmail":
      return GMAIL_SCOPES;
    case "google_calendar":
      return CALENDAR_SCOPES;
    default:
      return EMAIL_SCOPES;
  }
}

export interface GoogleTokens {
  accessToken: string;
  /** Absent on refresh responses; Google only returns it on first consent. */
  refreshToken?: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  scope: string;
}

import { getGoogleCredentials } from "@/server/settings";

async function clientCredentials(): Promise<{
  clientId: string;
  clientSecret: string;
}> {
  const { clientId, clientSecret } = await getGoogleCredentials();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Google isn't configured yet. Add your Google client ID and secret " +
        "in Settings (see docs/google-oauth-setup.md).",
    );
  }
  return { clientId, clientSecret };
}

export async function isGoogleConfigured(): Promise<boolean> {
  const { clientId, clientSecret } = await getGoogleCredentials();
  return Boolean(clientId && clientSecret);
}

/** Redirect URI must match exactly what's registered in Google Cloud. */
export function googleRedirectUri(): string {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/+$/, "")}/api/connectors/google/callback`;
}

/** Build the Google consent URL to redirect the user to. */
export async function buildAuthUrl(options: {
  state: string;
  scopes?: string[];
}): Promise<string> {
  const { clientId } = await clientCredentials();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: (options.scopes ?? GMAIL_SCOPES).join(" "),
    access_type: "offline", // ask for a refresh token
    prompt: "consent", // force a refresh token on re-connect
    include_granted_scopes: "true", // incremental auth across phases
    state: options.state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function postToken(body: URLSearchParams): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(
      `Google token exchange failed: ${data.error_description ?? data.error ?? response.status}`,
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in ?? 3600,
    scope: data.scope ?? "",
  };
}

/** Exchange an authorization code (from the callback) for tokens. */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret } = await clientCredentials();
  return postToken(
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
    }),
  );
}

/** Get a fresh access token from a stored refresh token. */
export async function refreshAccessToken(
  refreshToken: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = await clientCredentials();
  return postToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  );
}

/** Look up the connected account's email address, to label it in the UI. */
export async function fetchUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to read Google profile (HTTP ${response.status})`);
  }
  const data = (await response.json()) as { email?: string };
  return data.email ?? "Google account";
}
