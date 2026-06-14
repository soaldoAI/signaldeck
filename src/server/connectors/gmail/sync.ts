// Gmail sync: pulls recent messages into the unified `messages` store.
// Called inline right after connecting (so the first briefing is immediate)
// and on a schedule by the worker. Idempotent — messages dedupe per account
// by provider id, so re-running never creates duplicates.

import { prisma } from "@/server/db/client";
import {
  getValidAccessToken,
  markHealth,
  ReauthRequiredError,
  type ConnectorAccount,
} from "@/server/connectors/accounts";
import { getMessage, listRecentMessageIds } from "./client";

export interface SyncResult {
  fetched: number;
  newMessages: number;
}

/** Sync one Gmail account. Updates the account's cursor and health. */
export async function syncGmailAccount(
  account: ConnectorAccount,
): Promise<SyncResult> {
  const accessToken = await getValidAccessToken(account);

  // Cursor is the epoch-seconds of the newest message synced so far.
  const afterEpochSec = account.cursor ? Number(account.cursor) : undefined;
  const ids = await listRecentMessageIds(accessToken, { afterEpochSec, max: 50 });

  // Skip ids we already have — avoids a metadata fetch per known message.
  const existing = await prisma.message.findMany({
    where: { accountId: account.id, externalId: { in: ids } },
    select: { externalId: true },
  });
  const seen = new Set(existing.map((m) => m.externalId));
  const newIds = ids.filter((id) => !seen.has(id));

  let newestEpochSec = afterEpochSec ?? 0;
  for (const id of newIds) {
    const message = await getMessage(accessToken, id);
    const epochSec = Math.floor(message.receivedAt.getTime() / 1000);
    if (epochSec > newestEpochSec) newestEpochSec = epochSec;

    await prisma.message.create({
      data: {
        accountId: account.id,
        connectorId: account.connectorId,
        externalId: message.externalId,
        threadId: message.threadId,
        fromName: message.fromName,
        fromEmail: message.fromEmail,
        subject: message.subject,
        snippet: message.snippet,
        receivedAt: message.receivedAt,
      },
    });
  }

  await prisma.connectorAccount.update({
    where: { id: account.id },
    data: {
      cursor: newestEpochSec ? String(newestEpochSec) : account.cursor,
      lastSyncedAt: new Date(),
      status: "connected",
      detail: "",
    },
  });

  return { fetched: ids.length, newMessages: newIds.length };
}

/** Sync every connected Gmail account; used by the worker. */
export async function syncAllGmail(): Promise<void> {
  const accounts = await prisma.connectorAccount.findMany({
    where: { connectorId: "gmail", status: { not: "disconnected" } },
  });
  for (const account of accounts) {
    try {
      const result = await syncGmailAccount(account);
      console.log(
        `[worker] synced gmail ${account.label}: ${result.fetched} fetched`,
      );
    } catch (error) {
      if (error instanceof ReauthRequiredError) {
        console.log(`[worker] gmail ${account.label} needs reconnect`);
      } else {
        await markHealth(account.id, "needs_attention", "Sync failed");
        console.error(`[worker] gmail sync error for ${account.label}`, error);
      }
    }
  }
}
