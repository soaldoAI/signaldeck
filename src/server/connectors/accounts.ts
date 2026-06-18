// Connector account persistence: stores OAuth tokens encrypted at rest and
// hands out valid access tokens (refreshing transparently). Shared by the
// app and the worker — no `server-only` / `next/*` imports.

import { prisma } from "@/server/db/client";
import { decryptSecret, encryptSecret } from "@/server/crypto/secrets";
import { refreshAccessToken, type GoogleTokens } from "./google/oauth";
import type { ConnectorAccount } from "@/generated/prisma/client";

export type { ConnectorAccount };

/** Thrown when an account needs the user to reconnect (refresh failed). */
export class ReauthRequiredError extends Error {}

function expiryFrom(expiresIn: number): Date {
  return new Date(Date.now() + expiresIn * 1000);
}

/**
 * Create or update the connector account for (user, connector), storing
 * tokens encrypted. A refresh token is only persisted when present (Google
 * omits it on re-grants), so we never overwrite a good one with nothing.
 */
export async function upsertGoogleAccount(params: {
  userId: string;
  connectorId: string;
  externalId: string;
  label: string;
  tokens: GoogleTokens;
}): Promise<ConnectorAccount> {
  const { userId, connectorId, externalId, label, tokens } = params;
  const common = {
    externalId,
    label,
    status: "connected",
    detail: "",
    accessToken: encryptSecret(tokens.accessToken),
    tokenExpiry: expiryFrom(tokens.expiresIn),
    scope: tokens.scope,
  };
  const refreshToken = tokens.refreshToken
    ? encryptSecret(tokens.refreshToken)
    : undefined;

  return prisma.connectorAccount.upsert({
    where: {
      userId_connectorId_externalId: { userId, connectorId, externalId },
    },
    create: {
      userId,
      connectorId,
      ...common,
      refreshToken: refreshToken ?? "",
    },
    update: {
      ...common,
      ...(refreshToken ? { refreshToken } : {}),
    },
  });
}

export function listAccounts(userId: string): Promise<ConnectorAccount[]> {
  return prisma.connectorAccount.findMany({ where: { userId } });
}

/**
 * Return a usable access token for the account, refreshing if it's expired
 * or about to. On refresh failure the account is flagged `needs_attention`
 * and {@link ReauthRequiredError} is thrown.
 */
export async function getValidAccessToken(
  account: ConnectorAccount,
): Promise<string> {
  const stillValid =
    account.tokenExpiry && account.tokenExpiry.getTime() - 60_000 > Date.now();
  if (stillValid) return decryptSecret(account.accessToken);

  if (!account.refreshToken) {
    await markHealth(account.id, "needs_attention", "Reconnect required");
    throw new ReauthRequiredError("No refresh token; reconnect required");
  }

  try {
    const refreshed = await refreshAccessToken(
      decryptSecret(account.refreshToken),
    );
    await prisma.connectorAccount.update({
      where: { id: account.id },
      data: {
        accessToken: encryptSecret(refreshed.accessToken),
        tokenExpiry: expiryFrom(refreshed.expiresIn),
        status: "connected",
        detail: "",
        ...(refreshed.refreshToken
          ? { refreshToken: encryptSecret(refreshed.refreshToken) }
          : {}),
      },
    });
    return refreshed.accessToken;
  } catch {
    await markHealth(
      account.id,
      "needs_attention",
      "Sign-in expired — click Connect to reconnect",
    );
    throw new ReauthRequiredError("Token refresh failed; reconnect required");
  }
}

export async function markHealth(
  accountId: string,
  status: "connected" | "needs_attention" | "disconnected",
  detail: string,
): Promise<void> {
  await prisma.connectorAccount
    .update({ where: { id: accountId }, data: { status, detail } })
    .catch(() => {});
}
