import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthUrl,
  exchangeCode,
  googleRedirectUri,
  isGoogleConfigured,
  refreshAccessToken,
} from "./oauth";

beforeEach(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.APP_URL = "http://localhost:3000";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAuthUrl", () => {
  it("includes the required OAuth parameters", async () => {
    const url = new URL(await buildAuthUrl({ state: "xyz" }));
    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    const p = url.searchParams;
    expect(p.get("client_id")).toBe("test-client-id");
    expect(p.get("state")).toBe("xyz");
    expect(p.get("access_type")).toBe("offline"); // needed for a refresh token
    expect(p.get("response_type")).toBe("code");
    expect(p.get("redirect_uri")).toBe(googleRedirectUri());
    expect(p.get("scope")).toContain("gmail.readonly");
  });

  it("derives the redirect URI from APP_URL", () => {
    expect(googleRedirectUri()).toBe(
      "http://localhost:3000/api/connectors/google/callback",
    );
  });
});

describe("isGoogleConfigured", () => {
  it("is false when credentials are missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(await isGoogleConfigured()).toBe(false);
  });
});

describe("token exchange", () => {
  function stubToken(body: unknown, ok = true) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok, json: async () => body }) as Response),
    );
  }

  it("maps a successful code exchange", async () => {
    stubToken({
      access_token: "at",
      refresh_token: "rt",
      expires_in: 3600,
      scope: "s",
    });
    const tokens = await exchangeCode("code123");
    expect(tokens).toEqual({
      accessToken: "at",
      refreshToken: "rt",
      expiresIn: 3600,
      scope: "s",
    });
  });

  it("throws with Google's error description", async () => {
    stubToken({ error: "invalid_grant", error_description: "bad code" }, false);
    await expect(exchangeCode("nope")).rejects.toThrow(/bad code/);
  });

  it("handles a refresh response without a new refresh token", async () => {
    stubToken({ access_token: "at2", expires_in: 3600, scope: "s" });
    const tokens = await refreshAccessToken("rt");
    expect(tokens.accessToken).toBe("at2");
    expect(tokens.refreshToken).toBeUndefined();
  });
});
